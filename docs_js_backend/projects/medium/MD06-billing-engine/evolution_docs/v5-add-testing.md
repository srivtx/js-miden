# MD06 Billing Engine — v5 Add Testing

> **Motto**: If you can't test it, you don't understand it.

## What Changed

Added `vitest` + `supertest` + `stripe-mock` (or local HTTP interceptor). Unit tests for validators, service tests for Stripe interactions, and integration tests for the full charge flow.

## Why

- **Money**: We cannot deploy a billing bug to production
- **Refactoring**: v6 (ESM) and v7 (state machines) will touch every file — tests prove nothing broke
- **Documentation**: Tests show the intended behavior better than prose

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Vitest        │─────▶│   Supertest     │─────▶│   Express App   │
│   (runner)      │      │   (HTTP client) │      │   (in-memory)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │  stripe-mock │
                                                   │  or MSW      │
                                                   └──────────────┘
```

## Code

```typescript
// tests/charge.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupStripeMock, teardownStripeMock } from './mocks/stripe.js';

describe('POST /charge', () => {
  beforeAll(setupStripeMock);
  afterAll(teardownStripeMock);

  it('creates a payment intent for valid input', async () => {
    const res = await request(app)
      .post('/charge')
      .send({ amount: 1000, currency: 'usd' })
      .expect(200);

    expect(res.body.clientSecret).toBeDefined();
    expect(res.body.clientSecret).toStartWith('pi_');
  });

  it('rejects negative amounts', async () => {
    const res = await request(app)
      .post('/charge')
      .send({ amount: -100, currency: 'usd' })
      .expect(400);

    expect(res.body.issues).toContainEqual(
      expect.objectContaining({ field: 'amount', message: 'Number must be greater than 0' })
    );
  });

  it('rejects invalid currency codes', async () => {
    const res = await request(app)
      .post('/charge')
      .send({ amount: 1000, currency: 'dollar' })
      .expect(400);

    expect(res.body.issues).toContainEqual(
      expect.objectContaining({ field: 'currency', message: 'String must contain exactly 3 character(s)' })
    );
  });
});

// tests/webhook.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /webhooks/stripe', () => {
  it('returns 400 when signature is missing', async () => {
    await request(app)
      .post('/webhooks/stripe')
      .send({ type: 'invoice.payment_succeeded' })
      .expect(400);
  });

  it('processes a valid invoice.payment_succeeded event', async () => {
    // MSW or stripe-mock would provide a valid signature
    const payload = JSON.stringify(mockInvoicePaymentSucceeded);
    const signature = generateTestSignature(payload);

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', signature)
      .send(payload)
      .expect(200);

    expect(res.body.processed).toBe(true);
  });
});
```

## Decisions

**Option A: Jest**
- Pros: Ubiquitous, snapshot testing
- Cons: ESM support is painful, slower

**Option B: Vitest**
- Pros: Native ESM, Jest-compatible API, fast
- Cons: Smaller ecosystem

**Chosen: Vitest** — aligns with v6 ESM switch.

## Problems We Accepted

- Stripe mocking is imperfect; some edge cases (rate limits, idempotency) are hard to simulate
- No load tests yet (v7 will add them)
- Webhook signature tests require a helper to generate HMAC with the test secret

## Checklist

- [ ] All routes have at least one happy-path and one error test
- [ ] Zod validation failures are tested with precise error shapes
- [ ] Stripe interactions are mocked (no real network calls in CI)
- [ ] Tests run in < 5 seconds for the entire suite
- [ ] Coverage report is generated; target 80%+ for services

## Next Step

Switch to ESM so we can use top-level await and tree-shake Stripe SDK.
