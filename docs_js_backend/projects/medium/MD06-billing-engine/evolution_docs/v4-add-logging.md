# MD06 Billing Engine — v4 Add Logging

> **Motto**: In production, logs are your debugger.

## What Changed

Replaced `console.log` with `pino` structured JSON logging. Every charge request gets a `requestId`. Webhooks log the full event lifecycle. Added correlation IDs across async boundaries (Stripe webhooks → our API → database).

## Why

- **Compliance**: PCI-DSS requires audit trails for payment events
- **Debugging**: A customer says "I was charged twice" — search by `requestId` or `stripePaymentIntentId`
- **Alerting**: Log-based metrics (`error` level > 5/min) trigger PagerDuty

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│     Stripe      │
│  (Checkout) │      │  + pino logger  │      │   API           │
└─────────────┘      └────────┬────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  stdout /    │
                       │  log shipper │
                       └──────────────┘
```

## Code

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'billing-engine' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// src/middleware/requestId.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

// src/routes/charges.ts
import { logger } from '../utils/logger.js';

app.post('/charge', validateBody(chargeSchema), async (req, res) => {
  const requestId = (req as any).requestId;
  const log = logger.child({ requestId, route: 'POST /charge' });

  const { amount, currency } = req.body;
  log.info({ amount, currency }, 'Creating payment intent');

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { requestId },
    });
    log.info({ paymentIntentId: paymentIntent.id, status: paymentIntent.status }, 'Payment intent created');
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    log.error({ err }, 'Stripe payment intent failed');
    res.status(502).json({ error: 'Payment provider error' });
  }
});
```

## Decisions

**Option A: Winston**
- Pros: Transports (file, HTTP, cloud), formatting
- Cons: Slower, heavier config

**Option B: Pino**
- Pros: Fast (benchmarks 5x faster than Winston), structured by default, ESM-friendly
- Cons: Fewer built-in transports (we ship to stdout anyway)

**Chosen: Pino** — speed matters when every charge call logs 3+ lines.

## Problems We Accepted

- Logs are stdout-only; no log aggregation configured yet
- No automatic redaction of sensitive fields (we manually avoid logging `client_secret`)
- Still no idempotency; retries still create duplicate PaymentIntents

## Checklist

- [ ] `logger.child()` is used per-request so `requestId` is in every log line
- [ ] Stripe `client_secret` is NEVER logged
- [ ] Error logs include the full error object and request context
- [ ] Webhook handler logs event type, stripeEventId, and verification result

## Next Step

Add tests so we can refactor safely.
