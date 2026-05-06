# MD06 Billing Engine — v7 Production Setup

> **Motto**: Money sleeps for no one.

## What Changed

This is the full production-grade billing engine:
- **Stripe integration** with PaymentIntent lifecycle
- **Webhook security** — HMAC signature verification with `stripe.webhooks.constructEvent`
- **Idempotency** — deduplication via Redis + PostgreSQL (`subscriptionEvent` table)
- **State machine** — explicit `SubscriptionStatus` enum and guarded transitions
- **Dunning** — automated retry schedule for failed payments with exponential backoff
- **PCI compliance** — SAQ A (no cardholder data touches our servers)

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Billing API    │─────▶│  Payment        │
│  (Frontend) │      │  (Node.js ESM)  │      │  Gateway        │
└─────────────┘      │                 │      │  (Stripe)       │
                     │  - Subscriptions│      └─────────────────┘
                     │  - Invoicing    │               │
                     │  - Dunning      │               │
                     │  - Webhooks     │               ▼
                     └────────┬────────┘      ┌─────────────────┐
                              │               │  Webhook        │
                              ▼               │  Endpoint       │
                     ┌─────────────────┐      │  (HMAC verify)  │
                     │  PostgreSQL     │      └─────────────────┘
                     │  (subscriptions,│
                     │   invoices,     │
                     │   idempotency)  │
                     └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Redis          │
                     │  (idempotency   │
                     │   keys, rate    │
                     │   limiting)     │
                     └─────────────────┘
```

## Code

### Webhook Security

```typescript
// src/routes/webhooks.ts
import { Router, Request, Response } from 'express';
import { stripe } from '../utils/stripe.js';
import { subscriptionService } from '../services/subscriptionService.js';

const router = Router();

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const payload = req.body;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    logger.warn({ err }, 'Webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const result = await subscriptionService.handleWebhookEvent(event);
  res.json(result);
});

export default router;
```

### Idempotency

```typescript
// src/utils/idempotency.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function isProcessed(idempotencyKey: string): Promise<boolean> {
  const existing = await prisma.subscriptionEvent.findUnique({
    where: { stripeEventId: idempotencyKey },
  });
  return !!existing;
}

export async function markProcessed(
  idempotencyKey: string,
  type: string,
  data: unknown,
  subscriptionId: string
) {
  return prisma.subscriptionEvent.create({
    data: {
      stripeEventId: idempotencyKey,
      type,
      data: data as any,
      subscriptionId,
    },
  });
}
```

### State Machine

```typescript
// src/services/subscriptionService.ts (excerpt)
export class SubscriptionService {
  private validTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    [SubscriptionStatus.INCOMPLETE]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.INCOMPLETE_EXPIRED],
    [SubscriptionStatus.TRIALING]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELED],
    [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELED, SubscriptionStatus.PAUSED],
    [SubscriptionStatus.PAST_DUE]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED, SubscriptionStatus.UNPAID],
    [SubscriptionStatus.CANCELED]: [],
    [SubscriptionStatus.UNPAID]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED],
    [SubscriptionStatus.PAUSED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED],
    [SubscriptionStatus.INCOMPLETE_EXPIRED]: [SubscriptionStatus.ACTIVE],
  };

  canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
    return this.validTransitions[from]?.includes(to) ?? false;
  }

  async updateSubscriptionStatus(
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
    periodStart?: Date,
    periodEnd?: Date
  ) {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
    if (!subscription) throw new Error('Subscription not found');

    if (!this.canTransition(subscription.status, status)) {
      throw new Error(`Invalid transition: ${subscription.status} -> ${status}`);
    }

    return prisma.subscription.update({
      where: { id: subscription.id },
      data: { status, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, updatedAt: new Date() },
    });
  }
}
```

### Dunning

```typescript
// src/services/dunningService.ts
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { billingService } from './billingService.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
const DUNNING_SCHEDULE_DAYS = [1, 3, 7, 14]; // retry after 1, 3, 7, 14 days
const MAX_DUNNING_ATTEMPTS = 4;

export class DunningService {
  async handlePaymentFailure(subscriptionId: string, invoiceId: string) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return;

    const attempt = (sub.dunningAttempts || 0) + 1;
    if (attempt > MAX_DUNNING_ATTEMPTS) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
      });
      logger.info({ subscriptionId }, 'Subscription canceled after max dunning attempts');
      return;
    }

    const retryAt = new Date();
    retryAt.setDate(retryAt.getDate() + DUNNING_SCHEDULE_DAYS[attempt - 1]);

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { dunningAttempts: attempt, nextDunningAt: retryAt, status: SubscriptionStatus.PAST_DUE },
    });

    logger.info({ subscriptionId, attempt, retryAt }, 'Dunning retry scheduled');
  }
}
```

## Decisions

**State machine: enum vs string union**
- Option A: Prisma enum (DB-enforced)
- Option B: TypeScript string union (flexible)
- **Chosen: A** — database enforces valid states; TS gets types for free via Prisma Client

**Dunning: in-app scheduler vs external cron**
- Option A: `node-cron` inside the API process
- Option B: External cron job hitting `/admin/dunning`
- **Chosen: B** — separates scheduling from execution; cron is infrastructure, not app code

## Checklist

- [ ] No cardholder data (PAN, CVV) stored in the application database
- [ ] All charges are idempotent (checked via `subscriptionEvent` table)
- [ ] Webhooks are verified with HMAC before processing
- [ ] Subscription state machine is explicit and tested
- [ ] Dunning retries are capped and do not harass customers
- [ ] PCI-DSS SAQ A compliance is documented
- [ ] Redis is used for idempotency key TTL and rate limiting
- [ ] All async operations have structured logging with `requestId`

## Post-Mortem: v7 Bugs

1. **Race condition in subscription update** (fixed): Added `SELECT FOR UPDATE` equivalent via Prisma transactions
2. **Missing idempotency on payment processing** (fixed): `processPayment` now checks invoice status before updating
3. **No webhook signature verification** (fixed): `constructEvent` with `STRIPE_WEBHOOK_SECRET`

## Your Turn

- What happens if Stripe sends a webhook twice with the same event ID?
- How would you add proration to the state machine?
- Should dunning emails be sent by this service or a separate notification service?
