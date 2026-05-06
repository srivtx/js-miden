# v5-add-testing.md — "I broke the health endpoint adding auth"

## The Bug

You add caching to the health check to reduce database load:

```ts
let cachedStatus: HealthStatus | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

export async function checkHealth(): Promise<HealthStatus> {
  const now = Date.now();

  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const checks = {
    database: 'ok',
    redis: 'ok',
  };

  // You fire off checks but don't await them
  db.query('SELECT 1').catch(() => { checks.database = 'error'; });
  redis.ping().catch(() => { checks.redis = 'error'; });

  const status: HealthStatus = {
    status: 'healthy',
    checks,
  };

  cachedStatus = status;
  cachedAt = now;

  return status;
}
```

The database goes down. The health check still returns `healthy` because the async checks are fire-and-forget. The function returns before they complete. The cache stores the optimistic result.

The load balancer keeps sending traffic. Users see database errors. You get paged at 3am. You check the health endpoint manually:

```bash
curl http://localhost:3000/health
```

It returns `200 { status: 'healthy' }`. You think the database is fine. You spend 20 minutes checking the wrong thing.

You didn't test the health check with a failing database.

## The 3am Page, Redux

You fix the async bug by adding `await`:

```ts
const dbOk = await db.query('SELECT 1').then(() => true).catch(() => false);
const redisOk = await redis.ping().then(() => true).catch(() => false);
```

But now the health check takes 10 seconds because it waits for the database timeout. The load balancer's health check timeout is 5 seconds. It marks the server unhealthy. Traffic drops. Users see 502.

You didn't test the health check timing.

## Adding Vitest + Supertest

```bash
npm install -D vitest supertest @types/supertest
```

```ts
// tests/health.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { clearHealthCache } from '../src/health.js';
import { db } from '../src/db.js';
import { redis } from '../src/redis.js';

describe('Health Check', () => {
  beforeEach(() => {
    clearHealthCache();
  });

  it('returns 200 when all dependencies are healthy', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.database).toBe('ok');
    expect(res.body.checks.redis).toBe('ok');
  });

  it('returns 503 when database is down', async () => {
    const originalQuery = db.query.bind(db);
    db.query = () => Promise.reject(new Error('Connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.database).toBe('error');

    db.query = originalQuery;
  });

  it('returns 503 when redis is down', async () => {
    const originalPing = redis.ping.bind(redis);
    redis.ping = () => Promise.reject(new Error('Connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.redis).toBe('error');

    redis.ping = originalPing;
  });

  it('caches the result for 5 seconds', async () => {
    const res1 = await request(app).get('/health');
    expect(res1.status).toBe(200);

    // Break the database
    const originalQuery = db.query.bind(db);
    db.query = () => Promise.reject(new Error('Connection refused'));

    // Cached result should still be healthy
    const res2 = await request(app).get('/health');
    expect(res2.status).toBe(200);

    db.query = originalQuery;
  });
});
```

Run the tests:

```bash
npm test
```

The "database is down" test fails. The health check returns 200 even when `db.query` rejects. The test caught the fire-and-forget bug.

The "caches the result" test also fails. The cache doesn't actually cache because the async checks update the object after it's already been returned.

## Why Tests?

- **They test failure modes.** Not just "does it work when everything is fine" but "does it fail gracefully when things break."
- **They test timing.** Health checks need to be fast. Tests can measure duration.
- **They test caching.** Cache logic is subtle. Tests verify TTL behavior.
- **They prevent false positives.** A health check that always returns 200 is worse than no health check at all.

## What Changed

- Added Vitest and Supertest as dev dependencies
- Tests cover healthy, unhealthy DB, unhealthy Redis, and caching
- Tests mock dependencies to simulate failures
- Tests run in CI with `npm test`

## What We Still Need

Tests verify behavior. But our module system is CommonJS. Node.js 20+ prefers ESM. We need to modernize.

For that, we need to switch to ESM.
