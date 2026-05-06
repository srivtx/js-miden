import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Redis } from 'ioredis';
import request from 'supertest';
import express from 'express';
import { rateLimiter } from '../src/rate-limiter.js';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380', 10),
});

// Create test app
const app = express();
app.get('/api/data', rateLimiter, (_req, res) => {
  res.json({ success: true });
});

describe('Rate Limiter', () => {
  beforeEach(async () => {
    // Clean up all rate limit keys before each test
    const keys = await redis.keys('ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('should allow up to 10 requests per minute', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/api/data');
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBe('10');
      expect(res.headers['x-ratelimit-remaining']).toBe(String(9 - i));
    }
  });

  it('should block the 11th request', async () => {
    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/data');
    }

    const res = await request(app).get('/api/data');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too Many Requests');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('should return correct rate limit headers on blocked requests', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/data');
    }

    const res = await request(app).get('/api/data');
    expect(res.status).toBe(429);
    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(parseInt(res.headers['x-ratelimit-remaining'] as string)).toBeLessThanOrEqual(0);
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('should reset the counter after the window expires', async () => {
    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      await request(app).get('/api/data');
    }

    const blocked = await request(app).get('/api/data');
    expect(blocked.status).toBe(429);

    // Manually expire the key to simulate time passing
    const keys = await redis.keys('ratelimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
  });
});
