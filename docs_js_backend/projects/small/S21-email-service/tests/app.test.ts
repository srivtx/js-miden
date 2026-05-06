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
    assert.strictEqual(res.body.status, 'sent');
  });

  it('should track bounced emails', async () => {
    const res = await request(app)
      .post('/emails/send')
      .send({
        to: 'bounce@example.com',
        from: 'noreply@example.com',
        subject: 'Test',
        body: 'Body',
      });

    assert.strictEqual(res.status, 202);
    assert.strictEqual(res.body.status, 'bounced');
  });

  // FAILING TEST: No queue — sends synchronously, blocks response.
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
    // Should return in < 50ms if truly async/queued
    assert.ok(duration < 50, `Response took ${duration}ms, should be < 50ms for queued emails`);
    assert.strictEqual(res.body.status, 'queued', 'Should return queued, not sent');
  });

  // FAILING TEST: No retry — bounce = permanently failed.
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

    // After retry logic, bounced emails with < 3 attempts should be queued again
    assert.ok(statusRes.body.attempts > 0);
    assert.ok(
      statusRes.body.status === 'queued' || statusRes.body.status === 'sent',
      'Bounced emails should be retried, not permanently failed'
    );
  });
});
