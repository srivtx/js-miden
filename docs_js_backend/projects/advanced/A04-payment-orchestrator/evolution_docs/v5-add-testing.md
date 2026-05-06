# v5 — Adding Testing

You "fixed" a bug by wrapping the charge call in a try/catch. You deploy. Now ALL errors return 200 with `{ status: 'failed' }`. The frontend thinks the payment succeeded because it only checks `statusCode === 200`. You have no tests for error responses.

## The Fix: Automated Tests

```ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      charges: {
        create: vi.fn(),
      },
    })),
  };
});

import Stripe from 'stripe';
const mockStripe = new Stripe('') as any;

describe('Payment Orchestrator', () => {
  it('charges successfully with valid input', async () => {
    mockStripe.charges.create.mockResolvedValue({ id: 'ch_123', status: 'succeeded' });

    const res = await request(app)
      .post('/charge')
      .send({ amount: 1000, currency: 'usd', token: 'tok_visa' });

    expect(res.status).toBe(200);
    expect(res.body.chargeId).toBe('ch_123');
  });

  it('rejects negative amounts', async () => {
    const res = await request(app)
      .post('/charge')
      .send({ amount: -100, currency: 'usd', token: 'tok_visa' });

    expect(res.status).toBe(400);
  });

  it('rejects unsupported currencies', async () => {
    const res = await request(app)
      .post('/charge')
      .send({ amount: 1000, currency: 'xyz', token: 'tok_visa' });

    expect(res.status).toBe(400);
  });

  it('returns 502 on provider failure', async () => {
    mockStripe.charges.create.mockRejectedValue(new Error('Network error'));

    const res = await request(app)
      .post('/charge')
      .send({ amount: 1000, currency: 'usd', token: 'tok_visa' });

    expect(res.status).toBe(502);
    expect(res.body.status).toBe('failed');
  });

  it('uses idempotency key to prevent duplicates', async () => {
    mockStripe.charges.create.mockResolvedValue({ id: 'ch_456', status: 'succeeded' });

    const payload = { amount: 1000, currency: 'usd', token: 'tok_visa', idempotencyKey: 'key-123' };

    await request(app).post('/charge').send(payload);
    await request(app).post('/charge').send(payload);

    expect(mockStripe.charges.create).toHaveBeenCalledTimes(1);
  });
});
```

## What Tests Caught

- Error status code regression → caught
- Validation failures → caught
- Provider failure handling → caught
- Idempotency enforcement → caught

## The Confidence

Now you can add PayPal fallback, retry logic, or split the gateway and know that charge invariants hold.

**Next:** Let's switch to ESM before building the orchestration layer.
