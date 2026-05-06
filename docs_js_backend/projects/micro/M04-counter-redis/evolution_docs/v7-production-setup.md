# v7-production-setup.md — "The final version"

## The Journey

We started with a counter that died on restart:

```js
let count = 0;
app.post('/increment', (req, res) => {
  count = count + 1;
  res.json({ count });
});
```

Two servers? Two counters. Restart? Back to zero. Race condition? Lost increments.

Here's what we added and why:

| Step | What we added | What bug it prevents |
|------|--------------|----------------------|
| v1 | In-memory counter | Restart loses data, not shared across instances |
| v2 | TypeScript | `amout` typo → caught at compile time |
| v3 | Zod validation | `{ amount: -100 }` → 400 with clear error |
| v4 | Pino logging | Mystery NaN → searchable JSON with context |
| v5 | Vitest + Supertest | Read-modify-write loses increments → caught in CI |
| v6 | ESM | `require` cycles, no top-level await → gone |
| v7 | Production setup | Everything wired, intentional bug to find |

## Final File Structure

```
M04-counter-redis/
├── src/
│   ├── index.ts          # Entry point: Express routes, error handling
│   └── counter.ts        # Redis counter with read-modify-write
├── tests/
│   └── counter.test.ts   # Vitest: single, concurrent, missing key, corrupted
├── package.json          # ESM, scripts, dependencies
├── tsconfig.json         # strict, NodeNext module resolution
└── evolution_docs/       # This file and the journey
```

## Each File Explained

### `src/index.ts`

```ts
import express from 'express';
import { increment, getCount } from './counter.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/increment', async (_req, res) => {
  try {
    const count = await increment();
    res.json({ count });
  } catch (_err) {
    res.status(503).json({ error: 'Redis unavailable' });
  }
});

app.get('/count', async (_req, res) => {
  try {
    const count = await getCount();
    res.json({ count });
  } catch (_err) {
    res.status(503).json({ error: 'Redis unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Counter API listening on port ${PORT}`);
});
```

- Express routes with try/catch for Redis failures
- Returns 503 when Redis is down — don't crash, degrade gracefully

### `src/counter.ts`

```ts
import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

export async function increment(): Promise<number> {
  const current = await redis.get('counter');
  const value = parseInt(current || '0', 10) + 1;
  await redis.set('counter', value.toString());
  return value;
}

export async function getCount(): Promise<number> {
  const value = await redis.get('counter');
  return parseInt(value || '0', 10);
}
```

- `get` then `set` — looks correct in isolation
- `parseInt(value || '0', 10)` handles missing keys

## The Intentional Bug

`increment` uses a read-modify-write pattern which is **not atomic**:

1. Request A reads `5`
2. Request B reads `5`
3. Request A computes `6`, writes `6`
4. Request B computes `6`, writes `6`
5. Result: `6` (should be `7`)

Under concurrent load, multiple clients read the same value, increment locally, and write back the same new value. Increments are lost.

The test `handles concurrent increments correctly` fails because of this.

**Fix:** Use Redis `INCR` which is atomic:

```ts
export async function increment(): Promise<number> {
  return redis.incr('counter');
}
```

Redis `INCR` is a single atomic operation. No race condition. No lost increments.

## Running It

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Why This Matters

Distributed state is hard. "Read, then write" is the most common concurrency bug in backend engineering. It looks correct. It works in single-user tests. It fails under production load.

The bug is intentional. Find it. Fix it. The lesson: if two operations need to happen together, they need to be one operation.
