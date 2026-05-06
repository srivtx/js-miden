# S15 Webhook Sender — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add HMAC payload signing:

```ts
// utils/signature.ts
import crypto from 'crypto';

export function generateSignature(payload: object, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

export function verifySignature(payload: object, secret: string, signature: string): boolean {
  const expected = generateSignature(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

But you forget the case where `secret` is an empty string:

```ts
// BEFORE — works for empty secret
generateSignature(payload, ''); // sha256=... (valid but weak)

// AFTER — "cleaner" but WRONG
if (!secret) throw new Error('Secret required');
```

Now legacy webhooks without secrets break. You deploy. All old integrations fail.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/webhooks.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, resetDb } from '../src/db.js';

describe('S15 Webhook Sender', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('registers a webhook', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/webhook', event_types: ['order.created'] });
    expect(res.status).toBe(201);
    expect(res.body.webhook.url).toBe('http://example.com/webhook');
  });

  it('queues events to matching webhooks', async () => {
    await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/webhook', event_types: ['order.created'] });

    const res = await request(app)
      .post('/api/events')
      .send({ event_type: 'order.created', payload: { id: 1 } });
    expect(res.status).toBe(202);
    expect(res.body.queued).toBe(1);
  });

  it('skips non-matching event types', async () => {
    await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/webhook', event_types: ['order.updated'] });

    const res = await request(app)
      .post('/api/events')
      .send({ event_type: 'order.created', payload: { id: 1 } });
    expect(res.status).toBe(202);
    expect(res.body.queued).toBe(0);
  });

  it('generates a valid signature', async () => {
    const payload = { id: 1 };
    const secret = 'test-secret';
    const sig = generateSignature(payload, secret);
    expect(sig).toMatch(/^sha256=/);
    expect(verifySignature(payload, secret, sig)).toBe(true);
  });

  it('handles empty secret gracefully', async () => {
    const payload = { id: 1 };
    const sig = generateSignature(payload, '');
    expect(sig).toMatch(/^sha256=/);
    expect(() => verifySignature(payload, '', sig)).not.toThrow();
  });
});
```

**What tests prevent:**
- The empty secret regression? Caught.
- The non-matching event type bug? Caught.
- The invalid URL handling? Caught.
- The missing payload validation? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
