import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

describe('POST /contact', () => {
  beforeAll(async () => {
    await redis.flushall();
  });

  afterAll(async () => {
    await redis.flushall();
    await redis.quit();
  });

  it('accepts valid submissions', async () => {
    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        message: 'Hello there!',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Bob',
        email: 'not-an-email',
        message: 'Hello',
      });
    expect(res.status).toBe(400);
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Charlie',
        email: 'charlie@example.com',
        message: '',
      });
    expect(res.status).toBe(400);
  });

  it('catches bots via honeypot', async () => {
    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Bot',
        email: 'bot@example.com',
        message: 'Spam',
        website: 'http://spam.com',
      });
    // Honeypot returns 200 to avoid tipping off bots
    expect(res.status).toBe(200);
  });

  // This test demonstrates the BUG: no rate limiting
  it('BUG: allows more than 3 submissions without rate limiting', async () => {
    // Make 5 rapid requests from same IP
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/contact')
        .send({
          name: `Spammer ${i}`,
          email: `spam${i}@example.com`,
          message: 'Spam content',
        });
      // All should succeed because rateLimiter is not applied
      expect(res.status).toBe(200);
    }
  });
});
