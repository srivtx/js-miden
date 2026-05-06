# v4-add-logging.md — Simple Cache

## The Pain

In production, the cache became a black box:

```typescript
export class SimpleCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();

  set(key: string, value: T): void {
    const expiresAt = Date.now() + this.ttlMs;
    setTimeout(() => this.store.delete(key), this.ttlMs);
    this.store.set(key, { value, expiresAt });
  }
}
```

1. Cache hit rate? Unknown.
2. Orphaned timers accumulating? Unknown.
3. Memory growing? We only found out when the process crashed.
4. A key disappearing mysteriously? No audit trail.

## The Fix: Add Cache Metrics Logging

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'simple-cache' },
});
```

```typescript
// cache.ts
import { logger } from './logger.js';

export class SimpleCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private misses = 0;

  set(key: string, value: T): void {
    logger.debug({ key, size: this.store.size }, 'Cache set');
    // ...
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.misses++;
      logger.debug({ key, hits: this.hits, misses: this.misses }, 'Cache miss');
      return undefined;
    }
    this.hits++;
    logger.debug({ key, hits: this.hits, misses: this.misses }, 'Cache hit');
    return entry.value;
  }
}
```

Now we can observe:
```json
{"level":20,"time":1715000000000,"service":"simple-cache","key":"user:123","size":1001,"msg":"Cache set"}
{"level":20,"time":1715000000100,"service":"simple-cache","key":"user:123","hits":850,"misses":150,"msg":"Cache hit"}
```

Alerts fire when:
- `size` exceeds a threshold
- `misses` spike (possible cache stampede)
- Memory usage correlates with cache size

## But Logging Doesn't Fix Timer Leaks

The `setTimeout` per key is still orphaned. Logging shows the symptoms (keys disappearing, memory growing), but the root cause requires code changes (see v7).

> **Lesson:** Logging makes cache behavior observable. But observable bugs are still bugs — they just crash with better telemetry.
