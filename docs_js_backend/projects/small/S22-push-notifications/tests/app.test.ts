import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Push Notification Service', () => {
  it('should register a device token', async () => {
    const res = await request(app)
      .post('/notifications/tokens')
      .send({
        token: 'valid_android_token_12345',
        platform: 'android',
        userId: 'user-1',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.platform, 'android');
  });

  it('should send a push notification', async () => {
    await request(app)
      .post('/notifications/tokens')
      .send({ token: 'valid_ios_token_12345', platform: 'ios' });

    const res = await request(app)
      .post('/notifications/send')
      .send({
        title: 'Hello',
        body: 'World',
        tokens: ['valid_ios_token_12345'],
      });

    assert.strictEqual(res.status, 202);
    assert.strictEqual(res.body.status, 'sent');
  });

  // FAILING TEST: No token validation — sends to invalid tokens.
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

  // FAILING TEST: No batching — sends one by one.
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
    // With proper batching, 50 notifications should complete in < 100ms
    assert.ok(duration < 100, `Batch send took ${duration}ms, should be much faster with batching`);
    assert.strictEqual(res.body.sent, 50);
  });
});
