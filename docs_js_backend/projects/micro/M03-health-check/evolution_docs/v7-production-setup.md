# v7-production-setup.md — "The final version"

## The Journey

We started with a health check that lied:

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

The database was on fire. The load balancer was happy. Users were not.

Here's what we added and why:

| Step | What we added | What bug it prevents |
|------|--------------|----------------------|
| v1 | Static 200 | Database down → still healthy |
| v2 | TypeScript | `cheks` typo → caught at compile time |
| v3 | Zod query validation | `depth=deeeep` → 400 with clear error |
| v4 | Pino logging | Mystery 503s → searchable JSON with context |
| v5 | Vitest + Supertest | Caching breaks async checks → caught in CI |
| v6 | ESM | `require` cycles, no top-level await → gone |
| v7 | Production setup | Everything wired, intentional bug to find |

## Final File Structure

```
M03-health-check/
├── src/
│   ├── index.ts          # Entry point: start server, health endpoint
│   ├── health.ts         # Health check logic with caching
│   ├── db.ts             # PostgreSQL connection pool
│   └── redis.ts          # Redis connection
├── tests/
│   └── health.test.ts    # Vitest + Supertest: healthy, unhealthy, caching
├── package.json          # ESM, scripts, dependencies
├── tsconfig.json         # strict, NodeNext module resolution
└── evolution_docs/       # This file and the journey
```

## Each File Explained

### `src/index.ts`

```ts
import express from 'express';
import { checkHealth } from './health.js';

export const app = express();

app.get('/health', async (_req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (_error) {
    res.status(503).json({
      status: 'unhealthy',
      checks: { database: 'unknown', redis: 'unknown' },
    });
  }
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

- `app` is exported for tests
- `NODE_ENV !== 'test'` prevents the server from starting during tests
- Catches errors and returns 503 — never crash on a health check

### `src/health.ts`

```ts
import { db } from './db.js';
import { redis } from './redis.js';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: { database: string; redis: string };
}

let cachedStatus: HealthStatus | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

export function clearHealthCache(): void {
  cachedStatus = null;
  cachedAt = 0;
}

export async function checkHealth(): Promise<HealthStatus> {
  const now = Date.now();

  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const checks = { database: 'ok', redis: 'ok' };

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

- Caching prevents health checks from DDoSing the database
- `clearHealthCache()` lets tests reset state between runs

## The Intentional Bug

The async health checks (`db.query` and `redis.ping`) are initiated but never awaited. The function returns immediately with `status: 'healthy'` before the checks complete.

Even if the database is down, the endpoint returns 200 because:
1. `checks` is initialized to `{ database: 'ok', redis: 'ok' }`
2. The function returns before the `.catch()` handlers run
3. The cached result is always optimistic

**Fix:** Await the health checks before constructing the response:

```ts
const dbOk = await db.query('SELECT 1').then(() => true).catch(() => false);
const redisOk = await redis.ping().then(() => true).catch(() => false);

const checks = {
  database: dbOk ? 'ok' : 'error',
  redis: redisOk ? 'ok' : 'error',
};

const status: HealthStatus = {
  status: dbOk && redisOk ? 'healthy' : 'unhealthy',
  checks,
};
```

## Running It

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Why This Matters

A health check that lies is worse than no health check. It gives you false confidence while your users suffer. The async/await bug is subtle — the code looks like it's checking things, but it's actually fire-and-forget.

The bug is intentional. Find it. Fix it. The lesson: always await your promises. A missing `await` is a missing check.
