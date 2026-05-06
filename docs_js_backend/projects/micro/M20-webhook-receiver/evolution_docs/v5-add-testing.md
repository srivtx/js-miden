# M20 Webhook Receiver — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add Stripe webhook support. You refactor the signature verification:

```ts
// BEFORE — correct for GitHub
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

// AFTER — "unified" but BROKEN for GitHub
const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
```

GitHub signatures start with `sha256=`. Your "unified" code removes the prefix. Now GitHub webhooks always fail verification. You deploy. GitHub integration breaks. You have no tests for GitHub signature format.

Another regression:
```ts
// You change payload parsing to support form-encoded webhooks
// but forget that express.raw() gives Buffer, not string
const parsed = JSON.parse(payload); // Bug: payload is Buffer, JSON.parse accepts it but...
```

Actually `JSON.parse(Buffer)` works in Node.js, but it's implicit and fragile.

## The Fix: Comprehensive Tests

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import crypto from 'crypto';

describe('M20 Webhook Receiver', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /webhook/:provider rejects unknown provider', async () => {
    const res = await request(app).post('/webhook/unknown').send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown provider');
  });

  it('POST /webhook/github rejects missing signature', async () => {
    const res = await request(app)
      .post('/webhook/github')
      .set('Content-Type', 'application/json')
      .send('{"action":"opened"}');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid signature');
  });

  it('POST /webhook/github accepts valid signature', async () => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'default-github-secret';
    const payload = Buffer.from('{"action":"opened"}');
    const signature =
      'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const res = await request(app)
      .post('/webhook/github')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', 'test-id-123')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.provider).toBe('github');
    expect(res.body.processed).toBe(false);
  });

  it('POST /webhook/stripe rejects invalid signature', async () => {
    const payload = Buffer.from('{"id":"evt_123","type":"invoice.paid"}');
    const res = await request(app)
      .post('/webhook/stripe')
      .set('Stripe-Signature', 't=1234567890,v1=invalid')
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res.status).toBe(401);
  });

  it('GET /events returns logged events', async () => {
    const res = await request(app).get('/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});
```

**What tests prevent:**
- Breaking GitHub signature prefix? Caught — `sha256=` must be present.
- Removing provider whitelist? Caught — `unknown` must return 400.
- Breaking async acknowledgment? Caught — `processed: false` in 202 response.
- Changing event log format? Caught — `events` must be an array.

## The Pain That Remains

Your tests run with Vitest, but the app uses `require()` in places. Modern Node.js is ESM-first. Time to align.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
