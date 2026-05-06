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
