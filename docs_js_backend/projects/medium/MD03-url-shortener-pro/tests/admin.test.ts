import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma, disconnectDb } from '../src/db.js';
import { redis, disconnectRedis } from '../src/redis.js';

beforeAll(async () => {
  await prisma.clickEvent.deleteMany();
  await prisma.url.deleteMany();
  await prisma.counter.deleteMany();

  await prisma.url.create({
    data: {
      id: 'url-1',
      originalUrl: 'https://analytics-test.com',
      shortCode: 'analytic',
      clicks: 5,
    },
  });

  await prisma.clickEvent.createMany({
    data: [
      { urlId: 'url-1', ipAddress: '1.1.1.1', country: 'US', browser: 'Chrome' },
      { urlId: 'url-1', ipAddress: '2.2.2.2', country: 'UK', browser: 'Firefox' },
    ],
  });
});

afterAll(async () => {
  await disconnectDb();
  await disconnectRedis();
});

describe('Admin API', () => {
  it('should get URL analytics', async () => {
    const res = await request(app)
      .get('/admin/analytics/url-1')
      .set('x-user-id', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.data.totalClicks).toBe(2);
    expect(res.body.data.breakdown.countries.length).toBeGreaterThan(0);
  });

  it('should get admin stats', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('x-user-id', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.data.totalUrls).toBeGreaterThan(0);
  });
});
