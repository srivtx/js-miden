import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db.js';
import { redis } from '../src/redis.js';
import { clearHealthCache } from '../src/health.js';

describe('GET /health', () => {
  beforeEach(() => {
    clearHealthCache();
  });

  it('returns 200 when all services are healthy', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'healthy',
      checks: {
        database: 'ok',
        redis: 'ok',
      },
    });
  });

  it('returns 503 when database is down', async () => {
    vi.spyOn(db, 'query').mockRejectedValue(new Error('DB connection failed'));

    const res = await request(app).get('/health');

    // This assertion WILL FAIL due to the intentional bug.
    // The health check does not await the DB query, so it returns 200
    // even though the database is down.
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.database).toBe('error');

    vi.restoreAllMocks();
  });

  it('returns 503 when redis is down', async () => {
    vi.spyOn(redis, 'ping').mockRejectedValue(new Error('Redis connection failed'));

    const res = await request(app).get('/health');

    // This assertion WILL FAIL due to the intentional bug.
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.redis).toBe('error');

    vi.restoreAllMocks();
  });
});
