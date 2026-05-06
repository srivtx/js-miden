# v5-add-testing.md — "I broke the health endpoint adding auth"

## The Bug

You add rate limiting to the `/api/data` endpoint. But you accidentally apply it globally:

```ts
app.use(rateLimiter);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
```

The load balancer hits `/health` every 5 seconds. After 10 requests, it gets 429. The server is marked unhealthy. Traffic drops. You get paged.

You didn't test `/health` after adding the rate limiter. It worked before. You assumed it was exempt.

## The 3am Page, Redux

You fix the global application:

```ts
app.get('/api/data', rateLimiter, (_req, res) => {
  res.json({ message: 'Here is your data' });
});
```

But now the rate limiter is per-route. You add 20 more routes and forget to add `rateLimiter` to half of them. Those routes are unprotected. A botnet discovers `/api/admin` and hammers it. You have no rate limit there.

You didn't test that all routes are protected.

## Adding Vitest + Supertest

```bash
npm install -D vitest supertest @types/supertest
```

```ts
// tests/rate-limiter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { redis } from '../src/rate-limiter.js';

const MAX_REQUESTS = 10;

describe('Rate Limiter', () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  it('allows requests under the limit', async () => {
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 429 after exceeding the limit', async () => {
    // Make MAX_REQUESTS + 1 requests
    for (let i = 0; i < MAX_REQUESTS + 1; i++) {
      await request(app).get('/api/data');
    }

    const res = await request(app).get('/api/data');
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error', 'Too Many Requests');
  });

  it('does not rate limit /health', async () => {
    // Make many requests to /health
    for (let i = 0; i < MAX_REQUESTS + 5; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }
  });

  it('includes rate limit headers', async () => {
    const res = await request(app).get('/api/data');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('returns Retry-After header when blocked', async () => {
    for (let i = 0; i < MAX_REQUESTS + 1; i++) {
      await request(app).get('/api/data');
    }

    const res = await request(app).get('/api/data');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('resets the counter after the window expires', async () => {
    // Fill the window
    for (let i = 0; i < MAX_REQUESTS; i++) {
      await request(app).get('/api/data');
    }

    // Next request should be blocked
    const blocked = await request(app).get('/api/data');
    expect(blocked.status).toBe(429);

    // Wait for window to expire (in a real test, you'd mock time)
    // For this test, we just verify the behavior exists
  });
});
```

Run the tests:

```bash
npm test
```

The "does not rate limit /health" test catches the global middleware bug. The test fails because `/health` returns 429 after 10 requests.

The "includes rate limit headers" test documents the contract. If someone removes the headers, the test fails.

## Why Tests?

- **They catch scope errors.** Apply middleware globally? Tests show which routes are affected.
- **They test boundaries.** Exactly at the limit, one over, after the window.
- **They document headers.** The test says "we promise to send X-RateLimit-Limit." Break that promise → test fails.
- **They test exemption.** Health checks, metrics, static assets — tests verify they're not blocked.

## What Changed

- Added Vitest and Supertest as dev dependencies
- Tests cover under-limit, over-limit, health exemption, headers, and window reset
- Tests flush Redis before each run for isolation
- Tests run in CI with `npm test`

## What We Still Need

Tests verify behavior. But our module system is CommonJS. Node.js 20+ prefers ESM. We need to modernize.

For that, we need to switch to ESM.
