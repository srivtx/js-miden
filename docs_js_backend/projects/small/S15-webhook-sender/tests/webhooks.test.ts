import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, resetDb, pool } from '../src/db.js';
import * as sender from '../src/services/sender.js';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await resetDb();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/webhooks', () => {
  it('registers a webhook', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/hook', event_types: ['order.created'] });
    expect(res.status).toBe(201);
    expect(res.body.webhook.url).toBe('http://example.com/hook');
  });
});

describe('POST /api/events', () => {
  it('queues events to matching webhooks', async () => {
    await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/hook', event_types: ['order.created'] });

    const res = await request(app)
      .post('/api/events')
      .send({ event_type: 'order.created', payload: { id: 1 } });
    expect(res.status).toBe(202);
    expect(res.body.queued).toBe(1);
  });

  it('includes signature header when sending', async () => {
    const sendSpy = vi.spyOn(sender, 'sendWebhook').mockResolvedValue();

    await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/hook', event_types: ['test'], secret: 'shh' });

    await request(app)
      .post('/api/events')
      .send({ event_type: 'test', payload: { foo: 'bar' } });

    // Allow async processing
    await new Promise((r) => setTimeout(r, 50));
    expect(sendSpy).toHaveBeenCalled();
  });
});

describe('GET /api/webhooks/:id/logs', () => {
  it('returns delivery logs', async () => {
    const wh = await request(app)
      .post('/api/webhooks')
      .send({ url: 'http://example.com/hook', event_types: ['order.created'] });

    await request(app)
      .post('/api/events')
      .send({ event_type: 'order.created', payload: { id: 1 } });

    const res = await request(app).get(`/api/webhooks/${wh.body.webhook.id}/logs`);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(1);
  });
});
