# v5-add-testing.md — "I broke the health endpoint adding auth"

## The Bug

You switch from in-memory counter to Redis:

```ts
export async function increment(): Promise<number> {
  const current = await redis.get('counter');
  const value = parseInt(current || '0', 10) + 1;
  await redis.set('counter', value.toString());
  return value;
}
```

This looks correct in isolation. But under concurrent load, two requests read `5` at the same time, both write `6`. You lose an increment.

You add a test for the single-request case:

```ts
it('increments from 0 to 1', async () => {
  const count = await increment();
  expect(count).toBe(1);
});
```

It passes. You deploy. Under production load, the counter is consistently lower than expected. You spend hours checking Redis. The data is fine. The bug is in the read-modify-write race condition.

You didn't test concurrency.

## The 3am Page, Redux

You "fix" the race condition by switching to `redis.incr`:

```ts
export async function increment(): Promise<number> {
  return redis.incr('counter');
}
```

But now `getCount` still uses `parseInt`:

```ts
export async function getCount(): Promise<number> {
  const value = await redis.get('counter');
  return parseInt(value || '0', 10);
}
```

If the counter key is missing (Redis was flushed), `value` is `null`. `parseInt('0', 10)` returns `0`. That's fine. But if someone manually sets the key to `"not-a-number"`, `parseInt` returns `NaN`. The API returns `{ count: NaN }`. The frontend renders `null`.

You didn't test the edge case of a corrupted counter value.

## Adding Vitest + Supertest

```bash
npm install -D vitest supertest @types/supertest
```

```ts
// tests/counter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Redis } from 'ioredis';
import { increment, getCount } from '../src/counter.js';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

describe('Counter', () => {
  beforeEach(async () => {
    await redis.del('counter');
  });

  it('increments from 0 to 1', async () => {
    const count = await increment();
    expect(count).toBe(1);
  });

  it('handles concurrent increments correctly', async () => {
    // Simulate 10 concurrent increments
    const promises = Array.from({ length: 10 }, () => increment());
    await Promise.all(promises);

    const finalCount = await getCount();
    expect(finalCount).toBe(10);
  });

  it('returns 0 when counter is missing', async () => {
    await redis.del('counter');
    const count = await getCount();
    expect(count).toBe(0);
  });

  it('handles corrupted counter value gracefully', async () => {
    await redis.set('counter', 'not-a-number');
    const count = await getCount();
    expect(count).toBeNaN(); // Or we could expect it to throw, depending on design
  });
});
```

Run the tests:

```bash
npm test
```

The "concurrent increments" test fails. The final count is `7` or `8`, not `10`. The test caught the race condition.

The "corrupted counter value" test returns `NaN`. This documents the current behavior and forces a decision: should we throw? Return 0? Reset the counter?

## Why Tests?

- **They catch race conditions.** Single-request tests pass. Concurrent tests fail. That's the only way to find this bug.
- **They test edge cases.** Missing keys, corrupted data, Redis down — tests verify behavior.
- **They document atomicity.** The test says "10 concurrent increments must result in 10." That's a specification.
- **They prevent regressions.** Switch back to read-modify-write? The test fails.

## What Changed

- Added Vitest and Supertest as dev dependencies
- Tests cover single increment, concurrent increments, missing key, corrupted value
- Concurrent test uses `Promise.all` to simulate real load
- Tests run in CI with `npm test`

## What We Still Need

Tests verify behavior. But our module system is CommonJS. Node.js 20+ prefers ESM. We need to modernize.

For that, we need to switch to ESM.
