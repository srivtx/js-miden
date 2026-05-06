# M10: Simple Cache — Senior Engineer Review

## Review 1: "Don't Build Your Own Cache"

> *"I've reviewed too many PRs where a developer writes a 'simple' cache class with 200 lines of code, gets the LRU logic subtly wrong, and introduces a memory leak. `lru-cache` is written by Isaac Schlueter (npm's creator) and is used by npm, yarn, and Node.js itself. Unless you're at the scale where you need a custom eviction policy, use the library."*

**Verdict:** Agree. Reinventing caching is a classic bikeshedding trap.

## Review 2: "In-Memory Cache Doesn't Scale Horizontally"

> *"This cache lives in a single Node.js process. If you run 4 instances behind a load balancer, each has its own cache. A user hitting instance A won't benefit from a cache warmed on instance B. For multi-instance deployments, you need Redis or a shared cache. Don't let an in-memory cache become an invisible dependency that prevents scaling."*

**Verdict:** Agree. In-memory caching is fine for single-node apps or caching computed values. For user session data or shared state, use Redis.

## Review 3: "TTL is a Band-Aid for Missing Invalidation"

> *"Setting a 5-minute TTL because 'we don't know when data changes' is lazy engineering. If you update a user's email and the cache serves the old email for 5 minutes, that's a bug. TTL should be a safety net, not your primary invalidation strategy. Prefer explicit `cache.delete()` on write operations."*

**Verdict:** Partially agree. Explicit invalidation is ideal but complex in distributed systems. A short TTL (e.g., 60s) combined with explicit invalidation is a pragmatic compromise.

## Review 4: "Monitor Your Hit Rate"

> *"A cache with a 5% hit rate is just wasted memory. Add metrics. If your hit rate is low, your cache keys are too granular (cache key includes timestamp) or your TTL is too short. If your eviction rate is high, your `max` is too small."*

**Verdict:** Agree. Caching without metrics is guessing.

## Review 5: "Structured Clone is Expensive"

> *"Returning `structuredClone` copies from cache protects against mutation but adds serialization overhead. For primitive values and small objects, it's fine. For large nested objects (10KB+), the clone cost may exceed the cache benefit. Consider using immutable data structures or marking cached objects as read-only with `Object.freeze`."*

**Verdict:** Agree. For large objects, use `Object.freeze` at insertion time and document that consumers must not mutate.

## Review 6: "The Real Problem is Usually N+1, Not Missing Cache"

> *"Before adding a cache, check if you're doing N+1 queries. Caching a slow query is treating the symptom. Fixing the query (adding an index, using a JOIN) is treating the cause. A cache should be the last optimization, not the first."*

**Verdict:** Agree. Caching adds complexity. Optimize the data layer first.

## Final Verdict

The M10 Simple Cache pattern is **production-ready for single-node deployments** with these caveats:
1. Use `lru-cache`, don't roll your own.
2. Plan for Redis if horizontal scaling is on the roadmap.
3. Implement explicit invalidation; use TTL as a fallback.
4. Monitor hit rate and eviction rate.
5. Optimize queries before adding caches.

## Sources
- lru-cache GitHub: https://github.com/isaacs/node-lru-cache
- Martin Fowler --- Cache-Aside: https://martinfowler.com/bliki/CacheAside.html
- Node.js Cluster Mode: https://nodejs.org/api/cluster.html
