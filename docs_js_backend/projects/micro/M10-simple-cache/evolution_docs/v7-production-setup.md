# v7-production-setup.md — Simple Cache

## Final Production Setup

After evolving through 6 versions, here's the production-ready setup connecting to `src/`:

### `src/index.ts`
```typescript
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`M10 Simple Cache API running on http://localhost:${PORT}`);
});
```

### `src/cache.ts` (Current — with intentional bugs for learning)
```typescript
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlSeconds = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  set(key: string, value: T): void {
    const expiresAt = Date.now() + this.ttlMs;

    // BUG: setTimeout created but never stored/cleared.
    // Overwriting or deleting a key leaves orphaned timers.
    setTimeout(() => {
      this.store.delete(key);
    }, this.ttlMs);

    this.store.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  delete(key: string): boolean {
    // BUG: Timer is NOT cleared here.
    return this.store.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  size(): number {
    // BUG: Includes expired entries
    return this.store.size;
  }
}

export const cache = new SimpleCache<unknown>(60);
```

### What a Production Fix Looks Like

```typescript
export class ProductionCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttlMs: number;
  private sweepInterval: ReturnType<typeof setInterval>;

  constructor(maxSize = 1000, ttlSeconds = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
    this.sweepInterval = setInterval(() => this.sweep(), 30_000);
  }

  set(key: string, value: T): void {
    // LRU eviction: if at capacity and key is new, evict oldest
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Move to end to approximate LRU
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.sweepInterval);
    this.store.clear();
  }
}
```

### Evolution Summary

| Version | Added | Bug Caught / Pain Solved |
|---------|-------|--------------------------|
| v1 | Plain object cache | Prototype pollution, unbounded growth |
| v2 | TypeScript + Map | Typed keys/values, no prototype pollution |
| v3 | Validation (Zod) | Rejects empty keys, huge keys |
| v4 | Structured logging | Tracks hit rate, memory growth |
| v5 | Tests | Documents orphaned timer bug, unbounded Map |
| v6 | ESM | Resolves circular deps with metrics/logging |
| v7 | Production (LRU + TTL + sweep) | Bounded size, no timer leaks, periodic cleanup |

### Key Takeaway

Caching is the poster child for "works on my machine, explodes in production." The per-key `setTimeout` pattern looks elegant but is a memory leak trap. The production solution uses a **single periodic sweep** instead of N timers, **LRU eviction** for bounded memory, and **lazy cleanup on access** for immediate correctness.
