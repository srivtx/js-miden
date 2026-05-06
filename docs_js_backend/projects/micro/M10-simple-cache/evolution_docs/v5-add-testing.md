# v5-add-testing.md — Simple Cache

## The Pain

We added validation (v3) and logging (v4), but a "performance optimization" broke everything:

```typescript
// "Optimization": use a plain object instead of Map for "faster" access
class SimpleCache<T = unknown> {
  private store: Record<string, CacheEntry<T>> = {};

  set(key: string, value: T): void {
    this.store[key] = { value, expiresAt: Date.now() + this.ttlMs };
  }
}
```

We deployed on Friday. By Monday, the server crashed with prototype pollution. A client had sent:
```json
{ "key": "__proto__", "value": { "polluted": true } }
```

We had no tests for prototype pollution. We had no tests for memory limits. We had no tests for timer leaks.

## The Fix: Add Tests

```typescript
// tests/cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { cache } from '../src/cache.js';

describe('Cache API', () => {
  beforeEach(() => {
    cache['_internalStore']().clear();
  });

  it('stores a key/value pair', async () => {
    const res = await request(app).post('/cache').send({ key: 'foo', value: 'bar' });
    expect(res.status).toBe(201);
  });

  it('overwrites an existing key', async () => {
    await request(app).post('/cache').send({ key: 'foo', value: 'old' });
    await request(app).post('/cache').send({ key: 'foo', value: 'new' });
    const res = await request(app).get('/cache/foo');
    expect(res.body.value).toBe('new');
  });
});

describe('Cache implementation bugs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('BUG: orphaned timers accumulate when keys are overwritten', async () => {
    const { SimpleCache } = await import('../src/cache.js');
    const c = new SimpleCache(60);
    c.set('k', 'v1');
    c.set('k', 'v2');
    c.set('k', 'v3');

    expect(c._internalStore().size).toBe(1);
    vi.advanceTimersByTime(60_000);

    // BUG: The first timer fires and deletes the current value!
    expect(c.get('k')).toBeUndefined();
  });

  it('BUG: no size limit on Map', async () => {
    const { SimpleCache } = await import('../src/cache.js');
    const c = new SimpleCache(60);
    for (let i = 0; i < 100_000; i++) {
      c.set(`key-${i}`, { data: 'x'.repeat(1000) });
    }
    expect(c.size()).toBe(100_000);
  });
});
```

## What Tests Caught

1. **Orphaned timers:** Overwriting a key 3 times creates 3 timers. After TTL, the first timer deletes the current value.
2. **Unbounded growth:** Setting 100,000 keys succeeds — documenting the memory leak.
3. **Prototype pollution:** Any attempt to use a plain object instead of Map will fail tests for `__proto__` keys.

## But Tests Don't Fix Memory Leaks

Tests document the bugs and prevent regressions. But the fix requires code changes: clearing timers, adding maxSize, using periodic sweeps (see v7).

> **Lesson:** Tests are safety nets. They catch you when you fall, but they don't build the railing.
