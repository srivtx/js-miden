# M04: Counter API with Redis

## Overview

A simple counter API built with **Express 5**, **TypeScript** (ESM), and **Redis**.

**Endpoints:**
- `POST /increment` - Increments the counter by 1 and returns the new value
- `GET /count` - Returns the current counter value

## Quick Start

```bash
# 1. Start Redis
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Run the server
npm run dev
```

The server will start on `http://localhost:3000`.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Redis** | Fast, atomic operations with `INCR` |
| **AOF Persistence** | Redis configured with `appendonly yes` for durability |
| **Graceful Degradation** | Returns `503` if Redis is down (no fake data) |
| **No Caching** | Counter must be real-time |
| **TypeScript + ESM** | Modern, type-safe JavaScript |

## The Intentional Bug

The `increment()` function in `src/counter.ts` implements a **read-modify-write** pattern:

```typescript
const current = await redis.get('counter');
const value = parseInt(current || '0', 10) + 1;
await redis.set('counter', value.toString());
return value;
```

This is **not atomic**. Under concurrent load, multiple requests can read the same value before any of them writes back. Each request calculates the same new value and overwrites the key, causing **lost increments**.

### Prove the Bug

```bash
# Ensure Redis is fresh (count = 0)
redis-cli FLUSHDB

# Run the load test
npm run load-test
```

You will see that 1000 concurrent requests result in a count **significantly less than 1000**.

### The Fix

Replace the read-modify-write with Redis's atomic `INCR`:

```typescript
export async function increment(): Promise<number> {
  return redis.incr('counter');
}
```

`INCR` is a single atomic operation. No matter how many clients call it simultaneously, Redis guarantees every increment is counted.

## Testing

```bash
# Run unit tests (concurrency test will fail with the buggy code)
npm test
```

Note: The 100-concurrent-increments test is **expected to fail** while the bug is present. After applying the fix, all tests should pass.

## Project Structure

```
.
├── README.md
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── load-test.js              # Concurrent load test proving the race condition
├── src/
│   ├── index.ts              # Express server
│   └── counter.ts            # Counter logic (intentionally buggy)
└── tests/
    └── counter.test.ts       # Unit tests
```

## Why This Matters

Race conditions in read-modify-write patterns are one of the most common concurrency bugs. Even though the code uses `async/await` and looks sequential, the gap between `GET` and `SET` allows interleaving from other requests. **Always use atomic operations** when available.
