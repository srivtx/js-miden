# M10: Simple Cache — Architecture Decisions

## Decision 1: Storage Mechanism (Map vs LRU vs Redis)

**Option A: Plain Object `{}`**
```javascript
const cache = {};
```

**Option B: Map**
```javascript
const cache = new Map();
```

**Option C: lru-cache library**
```javascript
import { LRUCache } from 'lru-cache';
const cache = new LRUCache({ max: 500, ttl: 60000 });
```

**Option D: Redis**
```javascript
import { createClient } from 'redis';
const client = createClient();
```

**Decision:** Use **Option C (lru-cache)** for single-node applications, **Option D (Redis)** for distributed systems.

**Rationale:**
- Plain Object (A) has no size limit, no TTL, and prototype pollution risks.
- Map (B) is better than Object but still requires manual TTL and eviction logic.
- lru-cache (C) provides production-ready TTL, LRU eviction, and memory safety out of the box.
- Redis (D) is necessary when multiple Node.js processes need shared state.

**Trade-offs:**
- lru-cache adds a dependency (~25KB).
- Redis adds network latency and operational complexity.

**WRONG:** Using a global object for caching in production.
**RIGHT:** Using lru-cache for in-memory, Redis for distributed.

## Decision 2: TTL Implementation Strategy

**Option A: setTimeout per key**
```javascript
function set(key, value, ttl) {
  cache.set(key, value);
  const timer = setTimeout(() => cache.delete(key), ttl);
  timers.set(key, timer);
}
```

**Option B: Timestamp comparison on access**
```javascript
function set(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}
function get(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}
```

**Option C: Lazy sweeping + periodic cleanup**
Combine B with a periodic `setInterval` that scans and deletes expired entries.

**Decision:** Use **Option B (timestamp comparison)** as the primary mechanism, with optional periodic sweeping for long-lived caches.

**Rationale:**
- `setTimeout` (A) creates many timers, each consuming memory in the event loop. Canceling timers on every deletion is error-prone.
- Timestamp comparison (B) is O(1) for get/set and has no timer overhead.
- Periodic sweeping (C) prevents "zombie" entries that are never accessed again but still consume memory.

**Trade-offs:**
- Option B delays cleanup until the next access (or sweep). A key may occupy memory slightly past its TTL.
- Option A provides precise expiration but at higher memory cost.

**WRONG:** Creating a `setTimeout` for every cache entry without cleanup.
**RIGHT:** Using timestamp comparison or a well-tested library like lru-cache.

## Decision 3: Eviction Policy

**Option A: LRU (Least Recently Used)**
Evict the item that hasn't been accessed for the longest time.

**Option B: LFU (Least Frequently Used)**
Evict the item with the fewest accesses.

**Option C: FIFO (First In, First Out)**
Evict the oldest item by insertion time.

**Decision:** Use **LRU** as the default.

**Rationale:**
- LRU captures temporal locality: recently accessed items are likely to be accessed again.
- LFU requires access counters and is prone to "cache pollution" from one-time bulk scans.
- FIFO is simple but ignores access patterns, leading to lower hit rates.

**Example:**
Access order: A, B, C, A, D
Cache size: 3

- **LRU:** After C, cache is [A, B, C]. Access A -> [B, C, A]. Insert D -> evict B -> [C, A, D]
- **LFU:** Counters: A=2, B=1, C=1. Insert D -> evict B or C (tie, usually FIFO tie-break).
- **FIFO:** After C, cache is [A, B, C]. Insert D -> evict A -> [B, C, D] (even though A was just accessed!)

**WRONG:** Using FIFO for an API response cache.
**RIGHT:** Using LRU for general-purpose caching.

## Sources
- lru-cache README: https://github.com/isaacs/node-lru-cache
- Redis Documentation: https://redis.io/docs/
