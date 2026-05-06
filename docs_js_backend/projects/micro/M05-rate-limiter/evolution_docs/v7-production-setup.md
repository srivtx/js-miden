# v7-production-setup.md — "The final version"

## The Journey

We started with no rate limiting. A single user could melt the server:

```js
app.get('/api/data', (req, res) => {
  res.json({ message: 'Here is your data' });
});
```

Then we added a naive Map. It leaked memory. Then we added Redis. Now we have distributed rate limiting.

Here's what we added and why:

| Step | What we added | What bug it prevents |
|------|--------------|----------------------|
| v1 | No rate limit | Anyone can DDoS accidentally |
| v2 | TypeScript | `identifer` typo → caught at compile time |
| v3 | Zod config validation | `MAX_REQS=-1` → crash at startup |
| v4 | Pino logging | Mystery blocks → searchable JSON with context |
| v5 | Vitest + Supertest | `/health` gets rate limited → caught in CI |
| v6 | ESM | `require` cycles, no dynamic imports → gone |
| v7 | Production setup | Everything wired, intentional bug to find |

## Final File Structure

```
M05-rate-limiter/
├── src/
│   ├── index.ts          # Entry point: routes, error handler
│   └── rate-limiter.ts   # Redis-based fixed-window rate limiter
├── tests/
│   └── rate-limiter.test.ts  # Vitest: limits, headers, health exemption
├── package.json          # ESM, scripts, dependencies
├── tsconfig.json         # strict, NodeNext module resolution
└── evolution_docs/       # This file and the journey
```

## Each File Explained

### `src/index.ts`

```ts
import express from 'express';
import { rateLimiter } from './rate-limiter.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/data', rateLimiter, (_req, res) => {
  res.json({ message: 'Here is your data', timestamp: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { app };
```

- `/health` is exempt from rate limiting
- `/api/data` is protected
- Global error handler catches middleware errors
- `app` is exported for tests

### `src/rate-limiter.ts`

```ts
import { Redis } from 'ioredis';
import type { Request, Response, NextFunction } from 'express';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380', 10),
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const WINDOW_SIZE_MS = 60 * 1000;
const MAX_REQUESTS = 10;

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_SIZE_MS) * WINDOW_SIZE_MS;
  const key = `ratelimit:${ip}:${windowStart}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.pexpire(key, WINDOW_SIZE_MS);
    }

    const ttl = await redis.pttl(key);
    const effectiveTtl = ttl > 0 ? ttl : WINDOW_SIZE_MS;
    const resetTime = now + effectiveTtl;

    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - current)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    if (current > MAX_REQUESTS) {
      res.setHeader('Retry-After', String(Math.ceil(effectiveTtl / 1000)));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(effectiveTtl / 1000)} seconds.`,
      });
    }

    next();
  } catch (err) {
    console.error('Rate limiter Redis error:', err);
    next(); // fail open
  }
}
```

- Uses Redis `INCR` and `PEXPIRE` for atomic counting
- Fixed-window algorithm — simple, but has edge cases at window boundaries
- `fail open` — if Redis is down, requests are allowed (better than blocking everything)
- Standard `X-RateLimit-*` headers tell clients their limit status

## The Intentional Bug

The rate limiter uses a **fixed window**. At the edge of a window, a user can make `MAX_REQUESTS` requests in the last second of one window and `MAX_REQUESTS` requests in the first second of the next window. That's `2 * MAX_REQUESTS` in 2 seconds — double the intended rate.

A **sliding window** would prevent this by tracking each request individually or using a sliding counter. The fixed window is simpler but allows burst attacks at the boundary.

**Fix:** Implement a sliding window algorithm. One approach: use Redis sorted sets to track request timestamps, or use a sliding log that counts requests in the last `WINDOW_SIZE_MS` instead of fixed buckets.

## Running It

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Why This Matters

Rate limiting is a contract. You promise users they get 10 requests per minute. At the window boundary, you break that promise. A malicious client can exploit the edge and get 20.

The fixed-window bug is intentional. Find it. Fix it. The lesson: simple algorithms have edge cases. Security features need to be correct at the boundaries.
