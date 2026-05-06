# M10: Simple Cache — Mental Models & Danger Zones

## Mental Model 1: Cache as a Transparent Layer

A cache should be **invisible** to the business logic. If the cache fails or is empty, the system should degrade gracefully to the primary data source. The cache is an optimization, not a source of truth.

**WHY:** If business logic depends on cache behavior (e.g., "we assume this is always in cache"), the system becomes fragile. Cache misses should be handled transparently.

## Mental Model 2: Cache Invalidation is Hard

> *"There are only two hard things in Computer Science: cache invalidation and naming things."* --- Phil Karlton

Invalidation strategies:
- **TTL (Time-To-Live):** Expire after fixed duration. Simple but can serve stale data.
- **Explicit invalidation:** Delete keys when data changes. Complex but precise.
- **Write-through:** Update cache and DB simultaneously. Reliable but slower writes.

**WHY:** Choosing the wrong strategy leads to stale data or excessive complexity.

## Mental Model 3: Memory is Not Infinite

Node.js runs with a default heap limit (~1.4GB for 64-bit systems). An unbounded cache will eventually hit this limit and crash the process.

**WHY:** Caches feel "free" because they avoid I/O, but they consume the most precious resource: RAM.

## Danger Zone 1: Unbounded Growth

Without a `max` size limit, every unique key added to the cache stays forever.

**Scenario:** Caching search results with the query string as the key.
```
GET /search?q=hello
GET /search?q=hello+world
GET /search?q=hello+world+2024
...
```
Each unique query creates a new cache entry. Over time, memory grows linearly with unique queries.

## Danger Zone 2: Orphaned Timers

Using `setTimeout` for TTL without cleanup:

```javascript
const cache = new Map();

function set(key, value, ttl) {
  cache.set(key, value);
  setTimeout(() => cache.delete(key), ttl); // Orphaned timer!
}

set('user:1', userData, 5000);
// Even if we call cache.delete('user:1') before 5s,
// the timer still fires and tries to delete a non-existent key.
```

**WHY:** The `setTimeout` callback holds a closure reference to `cache` and `key`, preventing garbage collection of those objects until the timer fires.

## Danger Zone 3: Thundering Herd

When a popular cached item expires, multiple concurrent requests may simultaneously attempt to regenerate it.

```
Time 0:   Cache miss for key "config"
Time 0:   Request 1 starts DB query
Time 0:   Request 2 starts DB query  (thundering herd!)
Time 50ms: Request 1 finishes, writes to cache
Time 50ms: Request 2 finishes, overwrites cache (wasted work)
```

**Mitigation:** Use a "cache stampede" protection pattern (e.g., locking or early recomputation).

## Danger Zone 4: Mutable Values

Storing mutable objects in cache and modifying them by reference:

```javascript
const user = cache.get('user:1');
user.name = 'Hacked'; // Mutates the cached object!
```

**WHY:** Objects in JavaScript are passed by reference. Modifying a cached object corrupts the cache for all future readers.

## Sources
- Martin Fowler --- Cache-Aside Pattern: https://martinfowler.com/bliki/CacheAside.html
- Node.js Event Loop: https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/
