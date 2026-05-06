# S21 Email Service — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the email service to "simplify" sending:

```ts
// BEFORE — correct
export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  validateSendRequest(req);
  const email: QueuedEmail = {
    id: generateId(),
    to: req.to,
    status: 'queued',
    attempts: 0,
    createdAt: new Date(),
  };
  emailStore.set(email.id, email);
  return email;
}

// AFTER — "cleaner" but BROKEN
export async function sendEmail(req: SendEmailRequest): Promise<QueuedEmail> {
  validateSendRequest(req);
  const email: QueuedEmail = {
    id: generateId(),
    to: req.to,
    status: 'queued',
    attempts: 0,
    createdAt: new Date(),
  };
  emailStore.set(email.id, email);
  
  // Oops, added synchronous send back in
  email.status = 'sending';
  const result = await mockSmtpSend(email);
  email.status = result.success ? 'sent' : 'bounced';
  
  return email;
}
```

Without tests, this ships. The HTTP response now blocks for 500ms per email. Your queue is bypassed. Bounced emails are permanently failed with no retry.

## The Fix: Comprehensive Email Tests

```ts
// tests/app.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Email Service', () => {
  it('should send an email with template variables', async () => {
    const res = await request(app)
      .post('/emails/send')
      .send({
        to: 'user@example.com',
        from: 'noreply@example.com',
        templateId: 'welcome',
        variables: { name: 'Alice' },
      });

    assert.strictEqual(res.status, 202);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.status, 'queued');
  });

  it('should return immediately with queued status', async () => {
    const start = Date.now();
    const res = await request(app)
      .post('/emails/send')
      .send({
        to: 'user@example.com',
        from: 'noreply@example.com',
        subject: 'Quick',
        body: 'Test',
      });
    const duration = Date.now() - start;

    assert.strictEqual(res.status, 202);
    assert.ok(duration < 50, `Response took ${duration}ms, should be < 50ms for queued emails`);
    assert.strictEqual(res.body.status, 'queued', 'Should return queued, not sent');
  });

  it('should retry bounced emails', async () => {
    const sendRes = await request(app)
      .post('/emails/send')
      .send({
        to: 'bounce@example.com',
        from: 'noreply@example.com',
        subject: 'Test',
        body: 'Body',
      });

    const id = sendRes.body.id;
    const statusRes = await request(app).get(`/emails/status/${id}`);

    assert.ok(statusRes.body.attempts > 0);
    assert.ok(
      statusRes.body.status === 'queued' || statusRes.body.status === 'sent',
      'Bounced emails should be retried, not permanently failed'
    );
  });
});
```

**What tests prevent:**
- Synchronous send? **Caught** — response must return in < 50ms with `queued` status.
- No retry? **Caught** — bounced emails must have `attempts > 0` and not be permanently failed.
- Missing template? **Caught** — 400 error for invalid template ID.

## The Pain That Remains

Your tests import from ESM files, but the project still has CJS vestiges. Modern Node.js is ESM-first. The test runner requires special flags because it's straddling both worlds.

## What v6 Fixes

Switch to ESM fully. CommonJS is legacy.
