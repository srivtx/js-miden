# S22 Push Notifications — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the push service to "simplify" batch sending:

```ts
// BEFORE — correct
export async function sendBatch(data: { notifications: { title: string; body: string; tokens: string[] }[] }): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  
  for (const item of data.notifications) {
    const notification = await sendPush(item);
    if (notification.status === 'sent') sent++;
    else failed++;
  }
  
  return { sent, failed, notifications: sentNotifications };
}

// AFTER — "cleaner" but BROKEN
export async function sendBatch(data: { notifications: { title: string; body: string; tokens: string[] }[] }): Promise<{ sent: number; failed: number }> {
  // Oops, removed the loop — only sends the first notification
  const notification = await sendPush(data.notifications[0]);
  return {
    sent: notification.status === 'sent' ? 1 : 0,
    failed: notification.status === 'failed' ? 1 : 0,
    notifications: [notification],
  };
}
```

Without tests, this ships. Only the first notification in a batch is sent. The other 49 are silently dropped. Your marketing campaign reaches 2% of the audience.

## The Fix: Comprehensive Push Tests

```ts
// tests/app.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Push Notification Service', () => {
  it('should reject invalid tokens before sending', async () => {
    const res = await request(app)
      .post('/notifications/send')
      .send({
        title: 'Hello',
        body: 'World',
        tokens: ['short', '', 'x'],
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('invalid') || res.body.error.includes('token'));
  });

  it('should batch send efficiently', async () => {
    const tokens: string[] = [];
    for (let i = 0; i < 50; i++) {
      const token = `valid_batch_token_${i}_12345678901234567890`;
      tokens.push(token);
      await request(app).post('/notifications/tokens').send({ token, platform: 'android' });
    }

    const start = Date.now();
    const res = await request(app)
      .post('/notifications/send-batch')
      .send({
        notifications: tokens.map(t => ({
          title: 'Batch',
          body: 'Test',
          tokens: [t],
        })),
      });
    const duration = Date.now() - start;

    assert.strictEqual(res.status, 202);
    assert.ok(duration < 100, `Batch send took ${duration}ms, should be much faster with batching`);
    assert.strictEqual(res.body.sent, 50);
  });
});
```

**What tests prevent:**
- Invalid tokens? **Caught** — 400 error before hitting the provider.
- Missing batch sends? **Caught** — all 50 notifications must be sent.
- Slow batch? **Caught** — must complete in < 100ms.

## The Pain That Remains

Your tests import from ESM files, but the project still has CJS vestiges. Modern Node.js is ESM-first. The test runner requires special flags because it's straddling both worlds.

## What v6 Fixes

Switch to ESM fully. CommonJS is legacy.
