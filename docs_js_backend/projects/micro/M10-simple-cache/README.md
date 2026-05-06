# M10: Simple Cache API

A minimal in-memory key/value cache API with TTL.

## Endpoints

- `POST /cache` - Store a key/value pair (expires after 60s)
- `GET /cache/:key` - Retrieve a value by key
- `DELETE /cache/:key` - Remove a key

## Quick Start

```bash
npm install
npm run dev      # development server on :3000
npm test         # run tests
```

## Phase 1: Basic Implementation

The first pass stores key/value pairs in a Map with a 60-second TTL.
Accessing an expired key lazily cleans it up and returns 404.

## Phase 2-3: Design Thinking

### 1. In-memory Map vs. Bounded Cache

**Decision needed:** Should we use a plain `Map` or an LRU cache?

- **Plain Map (current, BUGGY):** Simple, fast O(1) ops, but **unbounded**. Under load with many unique keys, memory grows forever. No eviction policy.
- **LRU Cache (correct):** Fixed `maxSize`. When full, evicts least-recently-used entry. Prevents memory exhaustion. Can be implemented with a doubly-linked list + Map for O(1) get/set/evict.

**Conclusion:** Production cache needs a `maxSize` with LRU eviction.

### 2. TTL Implementation Strategy

**Decision needed:** How do we expire keys?

- **setTimeout per key (current, BUGGY):** Each key gets its own timer. Problem: thousands of keys = thousands of timers. Overwriting or deleting a key must clear the old timer, or timers leak memory and may delete newer values incorrectly.
- **Lazy cleanup on access (partial fix):** On `get()`, check `expiresAt` and delete if past due. No timers needed, but expired entries stay in memory until accessed.
- **Periodic sweep (better for high volume):** One `setInterval` every N seconds scans entries and deletes expired ones. No per-key timers. Trade-off: CPU vs. memory predictability.
- **Hybrid (best):** Lazy cleanup on access + periodic sweep for entries that are never read. No per-key timers.

**Conclusion:** Per-key `setTimeout` is a trap. Use lazy + periodic sweep, or a time-bucketed expiry system.

### 3. Cleanup Strategy

**Decision needed:** When should expired entries actually be removed?

- **Lazy (on access):** Cheap, but dead keys occupy memory if never read again.
- **Periodic sweep:** Predictable memory, but costs CPU.
- **Immediate (timer):** Best memory footprint, but requires timer management.

**Conclusion:** For a small project, lazy + periodic sweep is the sweet spot. For a large cache, a hierarchical timing wheel is the industrial solution.

### 4. Max Size Enforcement

If using LRU:
- On `set()`, if `size >= maxSize`, evict tail (LRU item) before insertion.
- On `get()`, move accessed item to head (most-recently-used).
- On `delete()`, remove from both Map and linked list.

## Known Bug

The current implementation has **multiple memory leak issues**:

1. **Orphaned timers:** `setTimeout` is created per key but never stored or cleared. When a key is overwritten or deleted, the old timer still fires later and may incorrectly remove the new value, or leave a closure reference in memory forever.
2. **Unbounded Map:** There is no `maxSize`. An attacker (or misbehaving client) can fill memory by writing millions of unique keys.
3. **No periodic cleanup:** Expired entries are only removed on access. If a key is never read again, it stays in the Map forever (until process restart).

### How to fix

```typescript
class FixedCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;
  private sweepInterval: ReturnType<typeof setInterval>;

  constructor(maxSize = 1000, ttlSeconds = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
    // Periodic sweep every 30s
    this.sweepInterval = setInterval(() => this.sweep(), 30_000);
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey); // LRU approximation
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
