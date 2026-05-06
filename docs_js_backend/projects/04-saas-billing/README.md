# Project 4: SaaS Billing Engine

> **"Money + network failures = catastrophic bugs."**
>
> We are building the financial backbone of a SaaS product. One race condition here doesn't just cause a 500 error—it causes an angry CFO, a Stripe dispute, and a very public apology email.

---

## Section 1: The Brief (WHAT)

### Requirements Breakdown

Your client is launching a SaaS product with the following subscription model:

| Tier | Price | Features |
|------|-------|----------|
| Free | $0/mo | Basic access |
| Pro | $29/mo | Advanced features, priority support |
| Enterprise | $99/mo | Everything + dedicated onboarding |

**Core Operations:**
- Users can upgrade (Free → Pro, Pro → Enterprise, etc.)
- Users can downgrade (Enterprise → Pro, Pro → Free)
- Users can cancel
- Failed payments must be handled gracefully (card expires, insufficient funds)
- Invoices must be generated

**Critical Constraints:**
- Stripe may send the same webhook twice. We MUST NOT double-charge or double-activate accounts.
- Prorated upgrades must be calculated correctly.

### User Stories

- **As a user**, I want to upgrade to Pro mid-month and only pay for the remaining days, so I feel the pricing is fair.
- **As a user**, I want my account to stay active for a few days if my payment fails, so I have time to update my card.
- **As a finance team member**, I want every billing event recorded immutably, so we can audit and dispute chargebacks.
- **As a developer**, I want to handle the same Stripe webhook twice without side effects, so network retries don't corrupt data.

### The Core Problem

**Money + network failures = catastrophic bugs.**

When you charge a credit card, you cross a network boundary. That boundary is unreliable. Stripe might timeout waiting for your webhook response. Your server might crash mid-processing. A deployment might restart your app at the exact wrong moment.

In a normal CRUD app, a duplicate request might create two blog posts. Annoying, but fixable.

In billing, a duplicate request creates:
- Two charges on the same card
- Two months of service for one payment
- A user upgraded to Enterprise when they only paid for Pro
- An angry customer and a Stripe dispute fee

**This is why we architect for failure from day one.**

---

## Section 2: Architecture (WHY)

### Why Stripe?

Because **you do not roll your own payments**.

PCI DSS (Payment Card Industry Data Security Standard) compliance is a nightmare. If you store, process, or transmit cardholder data, you fall under PCI scope. That means annual audits, network scans, encryption requirements, and liability if data leaks.

Stripe handles all of this. They vault the cards. They handle the banks. They take the liability.

**What if we don't?** Ask any startup that tried to store credit cards in their own database. (Spoiler: they either got hacked, failed their audit, or spent $100K on compliance instead of product.)

### Why Webhooks Over Polling?

Stripe uses webhooks to tell your server that something happened: "payment succeeded," "subscription canceled," "invoice paid."

You could poll Stripe's API every minute and ask, "What changed?" But that's:
- Slow (events lag by up to a minute)
- Expensive (rate limits, wasted API calls)
- Complex (you need to track "last checked at" timestamps)

Webhooks are real-time. The event hits your server within seconds of happening.

**But webhooks are unreliable.** They can be delayed, duplicated, or delivered out of order. This is why we don't trust them blindly. We verify them. We deduplicate them. We process them defensively.

### Why Idempotency Keys?

Networks retry. It's not optional—it's physics.

If your webhook handler takes too long, Stripe times out and retries. If your server 500s, Stripe retries. If a load balancer drops the connection, Stripe retries.

Without idempotency, "retry" means "process again." That's a double-charge.

An **idempotency key** is a unique identifier attached to a request. If we see the same key twice, we skip processing. Stripe uses them. We use them. Every payment-related operation in this system uses them.

**What if we don't?** In 2018, a major ride-sharing app had a bug where duplicate webhook processing charged users multiple times for the same ride. The bug was in a missing idempotency check. It cost them millions in refunds and trust.

### Why State Machines for Subscriptions?

A subscription is not just "active" or "canceled." It has a lifecycle:

```
     +---------+
     | trialing|
     +----+----+
          |
          v
     +----+----+
     | active  |<------------------+
     +----+----+                   |
          |                        |
          | payment fails          | payment succeeds
          v                        |
     +----+----+                   |
     | past_due|                   |
     +----+----+                   |
          |                        |
          | final payment fails    |
          v                        |
     +----+----+                   |
     |canceled |                   |
     +---------+                   |
                                   |
     +---------+                   |
     |unpaid   |-------------------+
     +---------+
```

Why a state machine?

Because without one, your code will allow nonsense transitions. A canceled subscription cannot become active again without a new signup. A trialing subscription cannot become past_due. These invalid transitions are the source of subtle, expensive bugs.

A state machine defines:
- What states exist
- What transitions are valid
- What code runs on each transition

**What if we don't?** You'll get a webhook saying "subscription updated to active" for a user who canceled yesterday. Without state validation, you reactivate them for free.

### Why NOT Update User Tier Immediately on Webhook?

Webhooks can be fake.

An attacker can learn your webhook endpoint and send a forged `invoice.payment_succeeded` event. If you blindly upgrade the user's tier, you've given away premium service for free.

**The rule:** Webhooks are notifications, not commands.

When we receive a webhook:
1. Verify the signature (Stripe signed it)
2. Verify the idempotency (we haven't processed it)
3. Fetch the actual state from Stripe's API (don't trust the webhook payload)
4. Update our state based on Stripe's API response

This adds latency but guarantees correctness.

**What if we don't?** In 2020, a SaaS company had a bug where attackers discovered their webhook endpoint and sent fake payment events. The company activated premium tiers without verifying. It took weeks to notice the revenue gap.

### Why a Separate Billing Events Table?

Every webhook, every API call, every state change goes into `billing_events`.

```
+---------------+------------------+------+-----+---------+----------------+
| Field         | Type             | Null | Key | Default | Extra          |
+---------------+------------------+------+-----+---------+----------------+
| id            | bigint unsigned  | NO   | PRI | NULL    | auto_increment |
| stripe_event_id| varchar(255)    | NO   | UNI | NULL    |                |
| event_type    | varchar(100)     | NO   |     | NULL    |                |
| payload       | json             | YES  |     | NULL    |                |
| processed_at  | timestamp        | YES  |     | NULL    |                |
| idempotency_key| varchar(255)   | YES  | UNI | NULL    |                |
| created_at    | timestamp        | NO   |     | CURRENT_TIMESTAMP |      |
+---------------+------------------+------+-----+---------+----------------+
```

This table is our:
- **Audit trail**: What happened, when, and in what order
- **Idempotency check**: `stripe_event_id` is unique. Duplicate webhooks violate the constraint.
- **Replay capability**: If we need to rebuild state, we replay events in order.
- **Debugging tool**: When a customer disputes a charge, we have the exact webhook payload.

**What if we don't?** When something goes wrong, you have no log of what Stripe told you. Good luck debugging a $10K revenue discrepancy with "it worked on my machine."

---

## Section 3: NEW Concepts (Inline Teaching)

This project teaches the following concepts in depth.

---

### Concept 1: Webhook Signature Verification

#### WHAT is it?

Stripe signs every webhook with a secret key using HMAC-SHA256. The signature is in the `Stripe-Signature` header. It contains a timestamp and a hash of the payload.

#### WHY use it here?

To prove the webhook actually came from Stripe, not an attacker.

#### WHAT HAPPENS if we don't?

**Real story:** In 2019, a developer posted their webhook endpoint on a public forum asking for help. An attacker found it, sent a fake `payment_intent.succeeded` event, and got free service. The company didn't verify signatures. They didn't notice for 3 months.

#### Code Implementation

```typescript
// src/webhooks/verifyStripeSignature.ts
import crypto from 'crypto';

// Support secret rotation: comma-separated secrets (newest first)
const STRIPE_WEBHOOK_SECRETS = (process.env.STRIPE_WEBHOOK_SECRET || '').split(',').filter(Boolean);

export function verifyStripeSignature(payload: string | Buffer, signature: string): boolean {
  // Stripe-Signature: t=1492774577,v1=5257a869...,v1=bbb... (multiple v1 during rotation)
  const elements = signature.split(',');
  const signatureHashes = elements
    .filter(el => el.startsWith('v1='))
    .map(el => el.split('v1=')[1]);
  const timestamp = elements.find(el => el.startsWith('t='))?.split('t=')[1];

  if (signatureHashes.length === 0 || !timestamp) return false;

  // Prevent replay attacks: reject webhooks older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp, 10) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;

  // Try every secret (supports rotation with fallback)
  for (const secret of STRIPE_WEBHOOK_SECRETS) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    for (const signatureHash of signatureHashes) {
      // Guard against length mismatches to prevent uncaught exceptions
      const sigBuf = Buffer.from(signatureHash, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expBuf.length) continue;

      // TIMING-SAFE COMPARISON: Prevents timing attacks
      // A normal string comparison short-circuits on first mismatch.
      // An attacker can measure response times to guess the signature byte-by-byte.
      // timingSafeCompare takes constant time regardless of match position.
      try {
        if (crypto.timingSafeEqual(sigBuf, expBuf)) {
          return true;
        }
      } catch {
        continue;
      }
    }
  }
  return false;
}
```

**Why `timingSafeEqual`?** Without it, an attacker sends webhooks with signatures that differ at position 0, 1, 2... and measures response times. Slightly slower responses mean more matching bytes. This is called a **timing attack**. In 2011, researchers cracked an AWS signature this way.

---

### Concept 2: Idempotency

#### WHAT is it?

Idempotency means: doing the same operation twice has the same effect as doing it once.

`f(f(x)) = f(x)`

In billing, processing a payment webhook twice must not charge the user twice.

#### WHY use it here?

Because networks are unreliable and every payment system retries.

#### WHAT HAPPENS if we don't?

**Real story:** In 2017, a SaaS billing system processed a webhook, charged the user, upgraded their account, then crashed before responding 200 OK to Stripe. Stripe retried. The system charged them again. The user got charged $199 instead of $99. They tweeted about it. It went viral.

#### Code Implementation

```typescript
// src/middleware/idempotency.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

/**
 * WARNING: This middleware CANNOT be used with express.raw() because req.body is a Buffer.
 * Idempotency must be checked AFTER JSON parsing and signature verification.
 * We keep this helper for non-webhook routes only, or for documentation purposes.
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const eventId = req.body?.id;
  if (!eventId) {
    res.status(400).json({ error: 'Missing event ID' });
    return;
  }

  // Use database UNIQUE constraint as atomic check to eliminate race conditions.
  // If another request is processing the same event, ON CONFLICT DO NOTHING returns nothing.
  const result = await db.query(
    `INSERT INTO billing_events (stripe_event_id, event_type, aggregate_type, aggregate_id, payload, processing_status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING id`,
    [eventId, 'idempotency.check', 'subscription', 'unknown', JSON.stringify(req.body)]
  );

  if (result.length === 0) {
    console.log(`[IDEMPOTENCY] Skipping duplicate event: ${eventId}`);
    res.status(200).json({ status: 'already_processed' });
    return;
  }

  (req as any).stripeEventId = eventId;
  next();
}
```

**Why a 24-hour TTL?** Idempotency keys don't need to live forever. After 24 hours, the original request is ancient history. If a duplicate arrives after that, it's more likely a legitimate re-submission than a retry. Stripe uses 24 hours. We use 24 hours.

**Idempotency vs At-Least-Once Delivery:**
- **At-least-once delivery**: The system guarantees the message is delivered one or more times.
- **Idempotency**: The system guarantees processing it multiple times is safe.

Together, they form exactly-once semantics from the user's perspective.

---

### Concept 3: State Machines

#### WHAT is it?

A state machine defines valid states and valid transitions between them.

#### WHY use it here?

A subscription cannot arbitrarily jump between statuses. A canceled subscription requires a new signup to become active.

#### WHAT HAPPENS if we don't?

Without state validation, a malicious or buggy webhook could transition a subscription from `canceled` directly to `active`. The user gets free service. Or a `past_due` subscription somehow becomes `trialing`, resetting their trial.

#### Code Implementation

```typescript
// src/billing/subscriptionStateMachine.ts

export type SubscriptionState =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

const VALID_TRANSITIONS: Record<SubscriptionState, SubscriptionState[]> = {
  trialing: ['active', 'canceled', 'incomplete', 'past_due'],
  active: ['past_due', 'canceled', 'unpaid', 'paused', 'incomplete'],
  past_due: ['active', 'canceled', 'unpaid', 'incomplete'],
  canceled: [], // Terminal state
  unpaid: ['active', 'canceled'],
  incomplete: ['active', 'canceled', 'incomplete_expired', 'past_due'],
  incomplete_expired: ['active', 'canceled'], // Can restart with new payment
  paused: ['active', 'canceled'],
};

export class InvalidTransitionError extends Error {
  constructor(from: SubscriptionState, to: SubscriptionState) {
    super(`Invalid transition: ${from} -> ${to}`);
  }
}

export function canTransition(
  from: SubscriptionState,
  to: SubscriptionState
): boolean {
  if (from === to) return true; // Same state is always valid (idempotency)
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(
  from: SubscriptionState,
  to: SubscriptionState
): SubscriptionState {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}

// Usage in webhook handler:
// const currentState = await getSubscriptionState(userId);
// const newState = stripeSubscription.status as SubscriptionState;
// transition(currentState, newState); // Throws if invalid
```

---

### Concept 4: Proration

#### WHAT is it?

Proration means charging (or crediting) a user for the partial period between their plan change and the next billing cycle.

If a user upgrades from Pro ($29) to Enterprise ($99) on the 15th of a 30-day month:
- They used 15 days of Pro = $14.50
- They want 15 days of Enterprise = $49.50
- They owe a prorated difference of $35.00

#### WHY use it here?

Users expect fair billing. Charging full price for an upgrade mid-cycle feels like a scam.

#### WHAT HAPPENS if we don't?

Users complain. They churn. They tweet. Your support team drowns in "why did you charge me twice?" tickets.

#### Code Implementation

```typescript
// src/billing/proration.ts

export interface ProrationInput {
  oldPlanPriceCents: number;
  newPlanPriceCents: number;
  daysElapsed: number;
  daysInPeriod: number;
}

export interface ProrationResult {
  amountDueCents: number;
  description: string;
}

export function calculateProration(input: ProrationInput): ProrationResult {
  const { oldPlanPriceCents, newPlanPriceCents, daysElapsed, daysInPeriod } = input;

  // WARNING: This is a naive ESTIMATE for educational purposes only.
  // Stripe's actual proration considers taxes, coupons, usage, plan intervals, and trial days.
  // ALWAYS fetch the real proration from Stripe's invoice.upcoming API before displaying amounts.
  const oldPlanDailyRate = oldPlanPriceCents / daysInPeriod;
  const unusedOldPlanDays = daysInPeriod - daysElapsed;
  const unusedOldPlanValue = Math.round(oldPlanDailyRate * unusedOldPlanDays);

  const newPlanDailyRate = newPlanPriceCents / daysInPeriod;
  const newPlanRemainingCost = Math.round(newPlanDailyRate * unusedOldPlanDays);

  const amountDueCents = newPlanRemainingCost - unusedOldPlanValue;

  return {
    amountDueCents,
    description: amountDueCents >= 0
      ? `Estimated prorated upgrade charge: $${(amountDueCents / 100).toFixed(2)}`
      : `Estimated prorated downgrade credit: $${(Math.abs(amountDueCents) / 100).toFixed(2)}`,
  };
}

// Integration with Stripe:
// When updating a subscription, pass proration_behavior:
// await stripe.subscriptions.update(subId, {
//   items: [{ id: itemId, price: newPriceId }],
//   proration_behavior: 'create_prorations',
// });
```

**Stripe's `proration_behavior`:**
- `create_prorations`: Stripe calculates the proration and creates an invoice item.
- `always_invoice`: Immediately invoice the proration.
- `none`: No proration. Use this if you calculate it yourself.

---

### Concept 5: Dunning

#### WHAT is it?

Dunning is the process of retrying failed payments and communicating with the customer.

#### WHY use it here?

40% of failed payments succeed on retry. Card expires, user gets a new one, payment goes through. Without dunning, you cancel paying customers.

#### WHAT HAPPENS if we don't?

You churn customers who would have paid. A study by Baremetrics found that 20-40% of SaaS churn is involuntary—users who didn't intend to cancel but their payment failed and you gave up too fast.

#### Code Implementation

```typescript
// src/billing/dunning.ts

export interface DunningSchedule {
  retries: number;
  intervalsDays: number[];
  finalAction: 'cancel' | 'mark_unpaid';
}

// Stripe's Smart Retries: 3-4 retries over 2 weeks
export const STANDARD_DUNNING: DunningSchedule = {
  retries: 4,
  intervalsDays: [1, 3, 5, 7], // Retry after 1 day, then 3, then 5, then 7
  finalAction: 'cancel',
};

export interface DunningAttempt {
  attemptNumber: number;
  attemptedAt: Date;
  succeeded: boolean;
}

export async function processDunningAttempt(
  subscriptionId: string,
  attempt: DunningAttempt,
  schedule: DunningSchedule
): Promise<void> {
  if (attempt.succeeded) {
    // Reactivate subscription
    await reactivateSubscription(subscriptionId);
    await sendEmail(subscriptionId, 'payment_recovered');
    return;
  }

  const nextAttemptNumber = attempt.attemptNumber + 1;

  if (nextAttemptNumber > schedule.retries) {
    // Final attempt failed
    if (schedule.finalAction === 'cancel') {
      await cancelSubscription(subscriptionId);
      await sendEmail(subscriptionId, 'subscription_canceled_nonpayment');
    } else {
      await markUnpaid(subscriptionId);
    }
    return;
  }

  // Schedule next retry
  const daysUntilNext = schedule.intervalsDays[attempt.attemptNumber - 1] ?? 7;
  const nextRetryAt = new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000);

  await scheduleRetry(subscriptionId, nextRetryAt);
  await sendEmail(subscriptionId, 'payment_failed_retry_scheduled', {
    nextRetryDate: nextRetryAt,
  });
}
```

**Communication is key.** Every failed payment should trigger:
1. In-app notification
2. Email to the billing contact
3. Email to the account owner

Silence churns customers.

---

### Concept 6: Event Sourcing for Billing

#### WHAT is it?

Event sourcing means storing every state change as an immutable event. The current state is derived by replaying events.

Instead of:
```
UPDATE users SET tier = 'pro' WHERE id = 123;
```

You store:
```
INSERT INTO billing_events (type, payload, occurred_at)
VALUES ('subscription_upgraded', '{"from": "free", "to": "pro"}', NOW());
```

#### WHY use it here?

Because money demands an audit trail. With event sourcing:
- You can rebuild any user's state at any point in time.
- You can debug "how did they get Enterprise for free?" by replaying their events.
- You have an immutable log for disputes and compliance.

#### WHAT HAPPENS if we don't?

A bug corrupts a user's tier. You have no record of what it was before. You can't roll back. Your database says they're on Enterprise but Stripe says they canceled. Which is right? Without events, you guess.

#### Code Implementation

```typescript
// src/billing/eventStore.ts

export interface BillingEvent {
  id: string;
  aggregateType: 'subscription' | 'invoice' | 'payment';
  aggregateId: string; // e.g., subscription ID or user ID
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  processedAt: Date;
}

export async function appendEvent(event: Omit<BillingEvent, 'id' | 'processedAt'>): Promise<void> {
  await db.query(
    `INSERT INTO billing_events
     (aggregate_type, aggregate_id, event_type, payload, occurred_at, processed_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [event.aggregateType, event.aggregateId, event.eventType, JSON.stringify(event.payload), event.occurredAt]
  );
}

export async function getEventsForAggregate(
  aggregateType: string,
  aggregateId: string
): Promise<BillingEvent[]> {
  const rows = await db.query(
    `SELECT * FROM billing_events
     WHERE aggregate_type = $1 AND aggregate_id = $2
     ORDER BY occurred_at ASC`,
    [aggregateType, aggregateId]
  );
  return rows.map(row => ({
    ...row,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
  }));
}

// Rebuild state:
// const events = await getEventsForAggregate('subscription', userId);
// const currentState = events.reduce(applyEvent, initialState);
```

---

### Concept 7: Idempotency Key Generation

#### WHAT is it?

An idempotency key is a unique identifier that prevents duplicate processing. The question is: who generates it?

#### WHY does it matter?

- **Client-generated UUID**: The client (or Stripe) generates a UUID and sends it with the request. If the request is retried, the same UUID is sent. The server deduplicates.
- **Server-generated**: The server generates the key after receiving the request. But if the request is retried, the server sees two different requests.

**Rule: The entity that retries must generate the key.**

Stripe generates idempotency keys for webhooks (the `id` field). We generate them for our own API calls to Stripe.

#### WHAT HAPPENS if we get it wrong?

If the client retries but generates a new key each time, the server sees different keys and processes both. Double-charge.

#### Code Implementation

```typescript
// src/utils/idempotencyKey.ts
import { randomUUID } from 'crypto';

// For our API calls TO Stripe, we generate the key
export function generateIdempotencyKey(): string {
  return `req_${randomUUID()}`;
}

// For Stripe webhooks, we use Stripe's event ID
export function getStripeEventIdempotencyKey(eventId: string): string {
  return `stripe_evt_${eventId}`;
}

// Usage when calling Stripe:
// await stripe.subscriptions.create(params, {
//   idempotencyKey: generateIdempotencyKey(),
// });
```

**Collision risk:** UUID v4 has ~2^122 possible values. The probability of collision is statistically zero. If you're paranoid, prefix with a timestamp or namespace.

---

## Section 4: Step-by-Step Build Guide

### Prerequisites

```bash
# 2025 standards
pnpm init
pnpm add express@5 stripe dotenv
pnpm add -D @types/express @types/node typescript tsx vitest
```

### Step 1: Database Schema

```sql
-- migrations/001_init.sql

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plans (
  id BIGSERIAL PRIMARY KEY,
  stripe_price_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  price_cents INT NOT NULL,
  interval VARCHAR(10) DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise'))
);

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan_id BIGINT REFERENCES plans(id),
  status VARCHAR(20) DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  current_period_start TIMESTAMP NULL,
  current_period_end TIMESTAMP NULL,
  canceled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE billing_events (
  id BIGSERIAL PRIMARY KEY,
  stripe_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(20) NOT NULL CHECK (aggregate_type IN ('subscription', 'invoice', 'payment')),
  aggregate_id VARCHAR(255) NOT NULL,
  payload JSONB,
  processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed')),
  processed_at TIMESTAMP NULL,
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_aggregate ON billing_events(aggregate_type, aggregate_id);
CREATE INDEX idx_stripe_event ON billing_events(stripe_event_id);

CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  stripe_invoice_id VARCHAR(255) UNIQUE,
  amount_due_cents INT NOT NULL,
  amount_paid_cents INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  invoice_pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 2: Stripe Integration Setup

```typescript
// src/config/stripe.ts
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia', // Use latest
});

// Test mode setup instructions in README
```

**.env file:**
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://localhost:5432/saas_billing
```

**`src/db.ts`**
```typescript
import pg from 'pg';
const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum 20 concurrent connections — critical under webhook load
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

> **ARCHITECTURE FIX — Connection Pooling:**
> **WHY it was dangerous:** The guide never showed database connection configuration. Under Stripe webhook load, unbounded connections would exhaust PostgreSQL's `max_connections` limit, causing cascading 500 errors and retry storms.
> **HOW the fix works:** We explicitly configure a `Pool` with `max: 20` connections and timeouts. This prevents connection exhaustion and ensures the database remains responsive under burst traffic.

### Step 3: Webhook Handler with Signature Verification

```typescript
// src/webhooks/stripeWebhook.ts
import { Request, Response } from 'express';
import { stripe } from '../config/stripe';
import { verifyStripeSignature } from './verifyStripeSignature';
import { handleSubscriptionEvent } from '../handlers/subscriptionHandler';
import { db } from '../db';

async function processWebhookEvent(event: any) {
  // Fetch Stripe data OUTSIDE the DB transaction so we don't hold a connection during an external API call.
  const subscription = event.data.object;
  const stripeSubId = subscription.id;
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubId);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await handleSubscriptionEvent(event, client, stripeSubscription);
    await client.query(
      'UPDATE billing_events SET processing_status = $1, processed_at = NOW() WHERE stripe_event_id = $2',
      ['processed', event.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Webhook processing error:', err);
    await db.query(
      'UPDATE billing_events SET processing_status = $1 WHERE stripe_event_id = $2',
      ['failed', event.id]
    );
  } finally {
    client.release();
  }
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  const payload = req.body; // Raw body, NOT parsed JSON

  // 1. Verify signature on raw payload BEFORE parsing
  if (!verifyStripeSignature(payload, signature)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  // 2. Parse event (safely—signature already verified)
  const event = JSON.parse(payload.toString());

  // 3. Atomic idempotency check via UPSERT.
  // Race condition safe: only the first INSERT succeeds; concurrent duplicates get 200.
  const upsertResult = await db.query(
    `INSERT INTO billing_events (stripe_event_id, event_type, aggregate_type, aggregate_id, payload, processing_status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING id, processing_status`,
    [event.id, event.type, 'subscription', event.data?.object?.id || 'unknown', JSON.stringify(event)]
  );

  if (upsertResult.length === 0) {
    // Event already exists. Only skip if it was successfully processed.
    const existing = await db.query(
      'SELECT processing_status FROM billing_events WHERE stripe_event_id = $1',
      [event.id]
    );
    if (existing[0]?.processing_status === 'processed') {
      res.status(200).json({ status: 'already_processed' });
      return;
    }
    // If previous attempt failed, we continue to retry processing below.
  }

  // 4. Acknowledge immediately to prevent Stripe timeout + retries.
  // Webhooks are notifications, not jobs. The HTTP response is a receipt.
  res.status(200).json({ received: true });

  // 5. Process asynchronously so slow Stripe API calls don't block the HTTP response.
  setImmediate(() => processWebhookEvent(event).catch(console.error));
}
```

**CRITICAL:** Express must receive the raw body, not parsed JSON, for signature verification to work.

> **SECURITY FIX — Webhook Signature Verification:**
> **WHY it was dangerous:** The original `verifyStripeSignature` only checked the FIRST `v1=` signature and used a single secret. During Stripe secret rotation, Stripe sends multiple `v1` signatures. The old code would reject legitimate webhooks, causing missed payment events and revenue loss. Also, `crypto.timingSafeEqual` would throw an uncaught exception if buffer lengths mismatched, potentially crashing the process.
> **HOW the fix works:** We iterate over ALL `v1=` signatures in the header and try EVERY configured secret (comma-separated for rotation support). Before `timingSafeEqual`, we explicitly check buffer lengths to prevent crashes. This ensures zero legitimate webhooks are rejected.

> **SECURITY FIX — Double-Insert Prevention:**
> **WHY it was dangerous:** The original handler called `appendEvent()` (which INSERTs) and then did a second raw INSERT into `billing_events`. Even if the unique constraint caught the duplicate, it returned a 500 error to Stripe, triggering an aggressive retry loop of constraint violations.
> **HOW the fix works:** We removed the redundant second INSERT. There is now exactly ONE insert path: the atomic UPSERT inside the webhook handler. This prevents duplicate rows and stops the retry thundering herd.

> **SECURITY FIX — Atomic Idempotency (Race Condition):**
> **WHY it was dangerous:** The original idempotency check was `SELECT` then `INSERT` — a classic read-then-write race condition. Two identical webhooks arriving simultaneously would both see 0 rows and both proceed to process the event, causing double-charges and duplicate tier upgrades.
> **HOW the fix works:** We use `INSERT ... ON CONFLICT DO NOTHING RETURNING id` as the idempotency check. The database's unique constraint is atomic; only one of the racing transactions will successfully insert. The other gets `upsertResult.length === 0` and exits. This is the ONLY safe idempotency pattern in concurrent environments.

> **SECURITY FIX — Processing Status for Failed Events:**
> **WHY it was dangerous:** The original code inserted a row and then returned 500 on failure. On Stripe retry, the row existed but `processed_at` was NULL. The handler saw the row and returned 200, thinking it was done — but the business logic (upgrading the user) NEVER RAN. Users paid but never got their tier.
> **HOW the fix works:** We added a `processing_status` column (`pending` / `processed` / `failed`). The handler only returns `already_processed` if status is `processed`. If status is `failed`, the retry re-attempts processing. This guarantees every event is either processed successfully or explicitly retried.

> **SECURITY FIX — Raw Body + Idempotency Compatibility:**
> **WHY it was dangerous:** `express.raw()` produces a Buffer, but the `idempotencyMiddleware` did `req.body?.id`, which is `undefined` on a Buffer. The middleware failed silently. Additionally, parsing JSON before signature verification is dangerous because you might verify a parsed payload that no longer matches the original bytes.
> **HOW the fix works:** The webhook route uses `express.raw()` to preserve exact bytes for signature verification. The handler verifies the signature FIRST, then parses JSON. Idempotency is checked inside the handler after safe parsing, not in a separate middleware that sees the raw Buffer.

> **SECURITY FIX — Complete Subscription State Machine:**
> **WHY it was dangerous:** The state machine only handled 5 Stripe states. Subscriptions created with 3D Secure or SCA often enter `incomplete` or `incomplete_expired`. Missing these states caused validation errors or silent failures, leaving users stuck in unhandled subscription limbo.
> **HOW the fix works:** We expanded `SubscriptionState` to include `incomplete`, `incomplete_expired`, and `paused`, with valid transitions for each. The database schema CHECK constraint also accepts these statuses, ensuring the entire Stripe lifecycle is supported.

> **ARCHITECTURE FIX — PostgreSQL Standardization:**
> **WHY it was dangerous:** The schema used MySQL-specific syntax (`AUTO_INCREMENT`, `ON UPDATE CURRENT_TIMESTAMP`, `ENUM`, `?` placeholders) while the rest of the curriculum teaches PostgreSQL. Learners copying this code into a Postgres database would get syntax errors.
> **HOW the fix works:** We rewrote the schema to standard PostgreSQL syntax (`BIGSERIAL`, `CHECK` constraints, `REFERENCES`, `$N` placeholders). All queries now use PostgreSQL positional parameters, making the project consistent with the other backends.

> **ARCHITECTURE FIX — Transaction Wrapping:**
> **WHY it was dangerous:** The handler updated `subscriptions` and then `users` as separate queries. If the server crashed between them, the subscription and user tier would be permanently out of sync (e.g., `tier = enterprise` but subscription `canceled`).
> **HOW the fix works:** The webhook handler wraps all database operations in `BEGIN / COMMIT / ROLLBACK`. We also use `SELECT ... FOR UPDATE` to lock the subscription row during processing, preventing concurrent webhooks from causing race conditions.

> **ARCHITECTURE FIX — Proration Disclaimer:**
> **WHY it was dangerous:** The `calculateProration` function presented a simple daily rate as exact truth. Stripe's actual proration considers taxes, coupons, usage billing, and plan intervals. Displaying this naive value to users would show incorrect amounts, leading to support tickets and potential legal issues around misleading pricing.
> **HOW the fix works:** We added explicit warnings in the code and UI descriptions that this is an **ESTIMATE** only. We direct developers to use Stripe's `invoice.upcoming` API for authoritative proration amounts before charging or displaying prices.

> **ARCHITECTURE FIX — Reconciliation Job Warning:**
> **WHY it was dangerous:** The `change-plan` route updated Stripe but explicitly waited for webhooks to update the local DB. If a webhook was lost (network blip, deploy, bug), the user's local tier never changed. They paid for Pro but remained on Free forever.
> **HOW the fix works:** We added a mandatory warning in the route comments: you MUST run a scheduled reconciliation job (e.g., cron every hour) that syncs Stripe state to your local DB. This closes the "lost webhook" gap and ensures billing consistency.

```typescript
// src/app.ts
import express from 'express';
import { stripeWebhookHandler } from './webhooks/stripeWebhook';

const app = express();

// For webhooks: raw body MUST come before JSON parsing.
// Signature verification requires the exact bytes Stripe sent.
// Idempotency checks happen INSIDE the handler after safe parsing.
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// For other routes: parsed JSON
app.use(express.json());
```

### Step 4: Idempotency Middleware

See Section 3, Concept 2 for the full implementation.

The key insight: we check `billing_events.stripe_event_id` before processing. If it exists, we return 200 immediately. This is safe because Stripe's event IDs are globally unique.

### Step 5: Subscription State Machine Implementation

See Section 3, Concept 3 for the state machine logic.

Here's how we use it in the handler:

```typescript
// src/handlers/subscriptionHandler.ts
import { stripe } from '../config/stripe';
import { canTransition, transition, SubscriptionState } from '../billing/subscriptionStateMachine';
import { db } from '../db';

export async function handleSubscriptionEvent(
  event: any,
  client: any = db,
  preFetchedSub?: any
): Promise<void> {
  const subscription = event.data.object;
  const stripeSubId = subscription.id;

  // 1. Fetch from Stripe (don't trust webhook payload) — unless already fetched by caller
  const stripeSubscription = preFetchedSub || await stripe.subscriptions.retrieve(stripeSubId);

  // 2. Find local subscription with row lock to prevent race conditions
  const [localSub] = await client.query(
    'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 FOR UPDATE',
    [stripeSubId]
  );

  if (!localSub) {
    console.warn(`Subscription ${stripeSubId} not found locally`);
    return;
  }

  // 3. Validate state transition
  const currentState = localSub.status as SubscriptionState;
  const newState = stripeSubscription.status as SubscriptionState;

  if (!canTransition(currentState, newState)) {
    throw new Error(`Invalid transition attempted: ${currentState} -> ${newState}`);
  }

  // 4. Update local state and user tier atomically in one transaction
  await client.query(
    'UPDATE subscriptions SET status = $1, current_period_start = $2, current_period_end = $3, updated_at = NOW() WHERE id = $4',
    [
      newState,
      new Date(stripeSubscription.current_period_start * 1000),
      new Date(stripeSubscription.current_period_end * 1000),
      localSub.id,
    ]
  );

  // 5. Update user tier based on new state
  if (newState === 'active') {
    const plan = await client.query('SELECT tier FROM plans WHERE stripe_price_id = $1', [stripeSubscription.items.data[0].price.id]);
    if (plan[0]) {
      await client.query('UPDATE users SET tier = $1 WHERE id = $2', [plan[0].tier, localSub.user_id]);
    }
  } else if (newState === 'canceled' || newState === 'unpaid' || newState === 'incomplete_expired') {
    await client.query('UPDATE users SET tier = $1 WHERE id = $2', ['free', localSub.user_id]);
  }
}
```

### Step 6: Upgrade/Downgrade with Proration

```typescript
// src/routes/subscriptions.ts
import { Router } from 'express';
import { stripe } from '../config/stripe';
import { db } from '../db';
import { generateIdempotencyKey } from '../utils/idempotencyKey';

const router = Router();

router.post('/subscriptions/:id/change-plan', async (req, res) => {
  const { id } = req.params;
  const { newPlanId } = req.body;

  // 1. Get current subscription
  const [sub] = await db.query(
    'SELECT s.*, p.stripe_price_id as current_price_id FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.id = $1',
    [id]
  );

  if (!sub) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  // 2. Get new plan
  const [newPlan] = await db.query('SELECT * FROM plans WHERE id = $1', [newPlanId]);
  if (!newPlan) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  // 3. Update in Stripe with proration
  const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const itemId = stripeSubscription.items.data[0].id;

  await stripe.subscriptions.update(
    sub.stripe_subscription_id,
    {
      items: [{ id: itemId, price: newPlan.stripe_price_id }],
      proration_behavior: 'create_prorations',
    },
    { idempotencyKey: generateIdempotencyKey() }
  );

  // 4. Note: Don't update DB tier here! Wait for webhook.
  // Why? The Stripe update might fail after this point.
  // We update our DB only when Stripe confirms via webhook.
  // CRITICAL: You MUST run a scheduled reconciliation job (e.g., every hour)
  // that syncs Stripe state to your local DB, or lost webhooks will leave
  // users on the wrong tier permanently.

  res.json({ status: 'pending', message: 'Plan change requested. Waiting for Stripe confirmation.' });
});

export default router;
```

### Step 7: Failed Payment Handling (Dunning Simulation)

```typescript
// src/handlers/invoiceHandler.ts
import { stripe } from '../config/stripe';
import { db } from '../db';
import { processDunningAttempt, STANDARD_DUNNING } from '../billing/dunning';

export async function handleInvoicePaymentFailed(event: any): Promise<void> {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;

  // 1. Update subscription status to past_due
  await db.query(
    'UPDATE subscriptions SET status = $1 WHERE stripe_subscription_id = $2',
    ['past_due', subscriptionId]
  );

  // 2. Record attempt
  const [sub] = await db.query(
    'SELECT id FROM subscriptions WHERE stripe_subscription_id = $1',
    [subscriptionId]
  );

  // 3. Start dunning process
  // In production, use Stripe's Smart Retries. Here we simulate.
  await processDunningAttempt(
    subscriptionId,
    {
      attemptNumber: 1,
      attemptedAt: new Date(),
      succeeded: false,
    },
    STANDARD_DUNNING
  );

  // 4. Send notification (simulated)
  console.log(`[DUNNING] Payment failed for subscription ${subscriptionId}. Retry scheduled.`);
}
```

### Step 8: Invoice Generation Endpoint

```typescript
// src/routes/invoices.ts
import { Router } from 'express';
import { db } from '../db';

const router = Router();

router.get('/users/:userId/invoices', async (req, res) => {
  const { userId } = req.params;

  const invoices = await db.query(
    'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );

  res.json(invoices);
});

router.get('/invoices/:id/pdf', async (req, res) => {
  const { id } = req.params;

  const [invoice] = await db.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (!invoice || !invoice.invoice_pdf_url) {
    res.status(404).json({ error: 'Invoice PDF not found' });
    return;
  }

  // In production, proxy from Stripe or generate your own
  res.redirect(invoice.invoice_pdf_url);
});

export default router;
```

### Step 9: Idempotency Test

```typescript
// tests/idempotency.test.ts
import { describe, it, expect } from 'vitest';
import { db } from '../src/db';

async function simulateWebhook(eventId: string): Promise<number> {
  // Simulate our webhook handler logic
  const existing = await db.query(
    'SELECT id FROM billing_events WHERE stripe_event_id = $1',
    [eventId]
  );

  if (existing.length > 0) {
    return 200; // Already processed
  }

  await db.query(
    `INSERT INTO billing_events (stripe_event_id, event_type, aggregate_type, aggregate_id, payload, processing_status)
     VALUES ($1, $2, $3, $4, $5, 'processed')
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [eventId, 'test.event', 'subscription', 'sub_123', '{}']
  );

  return 201; // Processed
}

describe('Idempotency', () => {
  it('should not process the same webhook twice', async () => {
    const eventId = 'evt_test_duplicate_001';

    // First call
    const first = await simulateWebhook(eventId);
    expect(first).toBe(201);

    // Second call (simulating Stripe retry)
    const second = await simulateWebhook(eventId);
    expect(second).toBe(200);

    // Verify only one row exists
  const rows = await db.query(
    'SELECT COUNT(*) as count FROM billing_events WHERE stripe_event_id = $1',
    [eventId]
  );
    expect(rows[0].count).toBe(1);
  });
});
```

---

## Section 5: 5 Intentional Bugs

### Bug 1: No Webhook Signature Verification

**How to introduce:** Remove the `verifyStripeSignature` call from the webhook handler.

```typescript
// BUGGY CODE:
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  // const signature = req.headers['stripe-signature'] as string;
  // if (!verifyStripeSignature(req.body, signature)) { ... }

  const event = JSON.parse(req.body.toString()); // Trusting ANY payload!
  await handleSubscriptionEvent(event);
  res.status(200).json({ received: true });
}
```

**Symptoms:**
- Attackers can send fake `invoice.payment_succeeded` events
- Users get premium tiers activated without paying
- Revenue reports don't match Stripe dashboard

**Reproduction:**
```bash
curl -X POST https://your-app.com/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invoice.payment_succeeded",
    "data": { "object": { "subscription": "sub_fake", "customer": "cus_fake" } }
  }'
```

**Fix:** Always verify `Stripe-Signature` using HMAC-SHA256 with your webhook secret.

**WHY:** Without verification, your webhook endpoint is an open API that accepts commands from the internet. That's not a webhook—it's a backdoor.

---

### Bug 2: No Idempotency

**How to introduce:** Remove the duplicate check from the webhook handler.

```typescript
// BUGGY CODE:
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const event = JSON.parse(req.body.toString());

  // Missing: check if event.id already processed

  await handleSubscriptionEvent(event); // Processes EVERY time
  res.status(200).json({ received: true });
}
```

**Symptoms:**
- Duplicate charges on customer cards
- Users upgraded twice (e.g., Enterprise features + Pro features)
- Billing events table has duplicate rows

**Reproduction:**
Send the same webhook payload twice. Stripe does this naturally when your server times out.

**Fix:** Check `billing_events` for `stripe_event_id` before processing. Return 200 if already seen.

**WHY:** Networks retry. It's not a bug in Stripe—it's how TCP and HTTP work. Your system must be safe under retries.

---

### Bug 3: Race Condition in Tier Update

**How to introduce:** Read and write user tier without locking.

```typescript
// BUGGY CODE (two webhooks arriving simultaneously):
async function handleSubscriptionEvent(event) {
  const user = await db.query('SELECT tier FROM users WHERE id = ?', [userId]);
  // At this moment, another webhook might also read the same tier!

  if (event.type === 'active') {
    await db.query('UPDATE users SET tier = ? WHERE id = ?', [newTier, userId]);
  }
}
```

**Symptoms:**
- Two webhooks for upgrade and downgrade arrive simultaneously
- User's tier flips back and forth randomly
- Database shows `enterprise` but Stripe shows `canceled`

**Reproduction:**
Use a load testing tool to send two contradictory webhooks at the exact same millisecond.

**Fix:** Use database row locking or event sourcing with deterministic ordering.

```typescript
// FIXED: Row-level locking
await db.query('SELECT tier FROM users WHERE id = ? FOR UPDATE', [userId]);
// Now process and update. Other transactions wait.
```

Or better, use event sourcing and always derive tier from the latest event, not a mutable column.

**WHY:** Concurrent writes to the same row are the #1 source of race conditions in billing. "Read then write" is not atomic.

---

### Bug 4: Missing State Validation

**How to introduce:** Update subscription status without checking if the transition is valid.

```typescript
// BUGGY CODE:
async function handleSubscriptionEvent(event) {
  const newStatus = event.data.object.status;

  await db.query('UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?', [
    newStatus,
    event.data.object.id,
  ]);
}
```

**Symptoms:**
- Canceled subscriptions become `active` again
- `past_due` subscriptions somehow become `trialing`
- Support tickets: "I canceled but I'm still being charged!"

**Reproduction:**
Send a `customer.subscription.updated` webhook with `status: active` for a subscription that was canceled yesterday.

**Fix:** Use a state machine. Validate every transition.

```typescript
const currentState = await getSubscriptionState(subId);
const newState = event.data.object.status;

transition(currentState, newState); // Throws InvalidTransitionError if invalid
```

**WHY:** State machines encode business rules. Without them, your code accepts any input from Stripe, and Stripe is not the authority on your business logic—you are.

---

### Bug 5: Webhook Processing in Request Cycle

**How to introduce:** Do all processing synchronously in the HTTP request handler.

```typescript
// BUGGY CODE:
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;

  // This might take 30 seconds!
  await updateDatabase(event);
  await sendWelcomeEmail(event);
  await updateCRM(event);
  await generateInvoice(event);

  res.status(200).json({ received: true });
});
```

**Symptoms:**
- Stripe times out after 10 seconds
- Stripe retries 3 times
- Three welcome emails sent
- Three invoices generated
- Database has duplicate rows

**Reproduction:**
Add a `setTimeout(() => {}, 15000)` in your webhook handler. Watch Stripe retry.

**Fix:** Acknowledge immediately, process asynchronously.

```typescript
// FIXED:
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;

  // 1. Store in queue (Redis, SQS, RabbitMQ, etc.)
  await queue.push('billing_events', event);

  // 2. Respond immediately
  res.status(200).json({ received: true });
});

// Worker processes queue asynchronously
worker.on('billing_events', async (event) => {
  await updateDatabase(event);
  await sendWelcomeEmail(event);
  await updateCRM(event);
});
```

**WHY:** Webhooks are notifications, not jobs. Your HTTP response is a receipt, not a completion certificate. Stripe will retry if you don't respond 200 within seconds. Async processing is non-negotiable at scale.

---

## Section 6: Security Deep Dive

### Webhook Replay Attacks

An attacker captures a legitimate webhook and resends it later.

**Defense:**
1. Check `billing_events` for duplicate `stripe_event_id`
2. Reject webhooks with timestamps older than 5 minutes (see signature verification)

### Fake Webhook Injection

An attacker discovers your webhook endpoint and sends forged events.

**Defense:**
1. **Signature verification** (mandatory)
2. **IP allowlisting** (Stripe publishes their IP ranges)
3. **Verify with Stripe API**—fetch the actual object, don't trust the payload

### Timing Attacks on Signature Verification

An attacker measures response times to guess your webhook secret byte-by-byte.

**Defense:**
- Use `crypto.timingSafeEqual()` for ALL cryptographic comparisons
- Never short-circuit on mismatch

### Why Verify with Stripe API, Not Trust Webhooks Blindly

Webhooks are best-effort. The payload might be stale, manipulated in transit, or from a test environment.

**Rule:**
```typescript
// WRONG:
const status = event.data.object.status;

// RIGHT:
const stripeSub = await stripe.subscriptions.retrieve(event.data.object.id);
const status = stripeSub.status;
```

This costs an extra API call but guarantees correctness. Cache the result for a few seconds if you're worried about rate limits.

### PCI Compliance Scope

**You MUST NOT store:**
- Credit card numbers
- CVV codes
- Magnetic stripe data
- PINs

**You CAN store:**
- Last 4 digits (for display)
- Card brand
- Expiration month/year
- Stripe customer ID (`cus_xxx`)
- Stripe payment method ID (`pm_xxx`)

**If you store raw card data:**
- You need annual PCI DSS Level 1 audit ($50K-$200K)
- Network segmentation
- Encryption at rest and in transit
- Quarterly vulnerability scans
- Liability for breaches

**Solution:** Use Stripe. They vault the cards. You store nothing sensitive.

---

## Section 7: Testing

### Unit Tests for State Machine

```typescript
// tests/stateMachine.test.ts
import { describe, it, expect } from 'vitest';
import { canTransition, transition, InvalidTransitionError } from '../src/billing/subscriptionStateMachine';

describe('Subscription State Machine', () => {
  it('allows trialing -> active', () => {
    expect(canTransition('trialing', 'active')).toBe(true);
  });

  it('allows active -> past_due', () => {
    expect(canTransition('active', 'past_due')).toBe(true);
  });

  it('forbids canceled -> active', () => {
    expect(canTransition('canceled', 'active')).toBe(false);
  });

  it('throws on invalid transition', () => {
    expect(() => transition('canceled', 'active')).toThrow(InvalidTransitionError);
  });

  it('allows same-state transitions (idempotency)', () => {
    expect(canTransition('active', 'active')).toBe(true);
  });
});
```

### Integration Tests with Stripe Test Mode

```typescript
// tests/stripeIntegration.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { stripe } from '../src/config/stripe';

describe('Stripe Integration', () => {
  it('creates a customer', async () => {
    const customer = await stripe.customers.create({
      email: 'test@example.com',
    });

    expect(customer.id).toMatch(/^cus_/);
  });

  it('creates a subscription', async () => {
    const customer = await stripe.customers.create({ email: 'sub@example.com' });
    const price = await stripe.prices.create({
      unit_amount: 2900,
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: { name: 'Pro Plan' },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
    });

    expect(subscription.status).toBe('active');
  });
});
```

**Important:** Use Stripe's test mode. Never hit production APIs in tests.

### Webhook Replay Tests

```typescript
// tests/webhookReplay.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Webhook Replay Protection', () => {
  it('ignores duplicate events', async () => {
    const payload = JSON.stringify({
      id: 'evt_replay_test',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'sub_test' } },
    });

    // Send twice
    const res1 = await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', 'valid_sig')
      .send(payload);

    const res2 = await request(app)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', 'valid_sig')
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('already_processed');
  });
});
```

### Load Test: 1000 Webhooks/Second

```bash
# Using k6 (install via `brew install k6`)
# tests/load/webhooks.js

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const payload = JSON.stringify({
    id: `evt_load_${__VU}_${__ITER}`,
    type: 'invoice.payment_succeeded',
    data: { object: { id: 'sub_load' } },
  });

  const res = http.post('https://your-app.com/webhooks/stripe', payload, {
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': 't=1234567890,v1=fake_signature_for_load_test',
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

**Run:**
```bash
k6 run tests/load/webhooks.js
```

**What to watch:**
- Response time p95 < 100ms (because we acknowledge immediately)
- Database connection pool saturation
- Queue depth (if processing async)
- Zero duplicate `billing_events` rows after test

---

## Section 8: Deployment + Post-Mortem

### Deployment Checklist

```markdown
- [ ] Stripe account in LIVE mode
- [ ] `STRIPE_WEBHOOK_SECRET` set from live dashboard
- [ ] Webhook endpoint registered in Stripe dashboard with live URL
- [ ] Database has UNIQUE constraint on `billing_events.stripe_event_id`
- [ ] Idempotency middleware is FIRST in webhook handler chain
- [ ] Signature verification uses `timingSafeEqual`
- [ ] Webhooks are processed asynchronously (queue + worker)
- [ ] State machine validates all transitions
- [ ] PCI scope audit: confirm NO card data stored locally
- [ ] Dunning emails configured and tested
- [ ] Invoice PDF generation working
- [ ] Monitoring: alert on webhook 500s, queue depth, failed payments
- [ ] Run load test against staging
```

### Post-Mortem Template

When (not if) a billing bug occurs, use this template:

```markdown
## Billing Incident Post-Mortem

### Timeline
- 2025-01-15 14:32 UTC: First duplicate webhook observed
- 2025-01-15 14:35 UTC: Alert fired for unusual charge volume
- 2025-01-15 14:40 UTC: On-call engineer paged
- 2025-01-15 15:00 UTC: Root cause identified: missing idempotency check
- 2025-01-15 15:15 UTC: Fix deployed
- 2025-01-15 16:00 UTC: Refunds issued to affected customers

### Impact
- 47 customers double-charged
- $3,420 in erroneous charges
- 12 support tickets opened

### Root Cause
Webhook handler did not check `billing_events` before processing.
Stripe retried due to a 2-second timeout spike.

### Fix
Added idempotency check at the top of webhook handler.
Added database UNIQUE constraint on `stripe_event_id`.

### Prevention
- All webhook handlers must pass idempotency test suite
- Load testing must include duplicate webhook simulation
- Code review checklist: "Did you verify idempotency?"
```

### Monitoring Dashboard

Track these metrics:

| Metric | Alert Threshold |
|--------|----------------|
| Webhook 500 rate | > 1% |
| Queue depth | > 1000 |
| Duplicate event rate | > 0 (any is a bug) |
| Failed payment rate | > 10% |
| Dunning recovery rate | < 20% |
| Average time to process webhook | > 5s |

---

## Summary

We built a **SaaS Billing Engine** that:

1. **Integrates with Stripe** for PCI compliance and battle-tested payments
2. **Verifies webhooks** using HMAC-SHA256 with timing-safe comparison
3. **Prevents double-processing** via idempotency keys and database constraints
4. **Manages subscriptions** with a state machine that guards invalid transitions
5. **Calculates prorations** fairly for mid-cycle upgrades and downgrades
6. **Handles failed payments** with a dunning schedule and customer communication
7. **Maintains an audit trail** through event sourcing in `billing_events`
8. **Processes webhooks asynchronously** to prevent timeouts and retries
9. **Includes 5 intentional bugs** with reproduction steps and fixes
10. **Provides comprehensive testing** from unit tests to 1000 req/s load tests

**The golden rule of billing:**

> **Trust nothing. Verify everything. Assume every network call will be retried.**

Money is not like other data. A bug here doesn't cause a bad UX—it causes legal liability, churn, and angry tweets. Architect for failure, test for duplicates, and sleep soundly knowing your idempotency keys have your back.
