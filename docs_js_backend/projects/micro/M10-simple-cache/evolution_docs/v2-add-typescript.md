# v2-add-typescript.md — Simple Cache

## The Pain

In v1 (pure JS), we used a plain object. This caused two issues that TypeScript would have caught:

```javascript
const cache = {};

cache[123] = 'value';  // key is silently coerced to string
cache['__proto__'] = 'polluted';  // prototype pollution!

function get(key) {
  return cache[key];  // returns undefined for missing keys — or polluted values
}
```

1. Any non-string key is coerced, leading to unexpected collisions.
2. `__proto__` and `constructor` keys corrupt the object prototype.

## The Fix: Add TypeScript + Map

```typescript
// cache.ts
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
}
```

TypeScript + `Map`:
- Enforces `string` keys at compile time
- Eliminates prototype pollution (Map doesn't inherit from Object.prototype)
- Provides typed values via generics `<T>`

## But TypeScript Doesn't Catch Everything

TypeScript can't enforce a **maximum size** at the type level. The Map still grows unbounded. And `setTimeout` per key (added in v3-v4) creates timer leaks that types can't catch.

> **Lesson:** TypeScript + Map eliminates prototype pollution and key-coercion bugs. But runtime constraints (size limits, timer cleanup) require code, not types.
