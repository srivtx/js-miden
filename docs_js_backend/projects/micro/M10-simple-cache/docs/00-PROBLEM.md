# M10: Simple Cache — Problem Statement

## WHAT

Build an in-memory cache layer for a Node.js application that:
- Stores key-value pairs with a configurable Time-To-Live (TTL)
- Automatically evicts expired entries
- Supports size-based eviction to prevent unbounded memory growth
- Provides `get`, `set`, `delete`, and `clear` operations
- Is safe from memory leaks and orphaned timers

## WHY

Database queries and external API calls are slow. Caching frequently accessed data reduces latency and load. However, an unbounded cache or a cache without TTL leads to:

- **Stale data:** Users see outdated information indefinitely.
- **Memory leaks:** The cache grows until the process runs out of memory (OOM).
- **Orphaned timers:** `setTimeout` references prevent garbage collection even after entries are deleted.
- **Thundering herd:** Multiple requests for expired data hit the backend simultaneously.

## HOW

1. Choose a storage mechanism (`Map`, `Object`, or `lru-cache` library)
2. Implement TTL using `setTimeout` or timestamp comparison
3. Implement eviction policy (LRU, LFU, or FIFO)
4. Add size limits and automatic cleanup
5. Ensure timers are cleared on explicit deletion to prevent leaks

## WRONG vs RIGHT

**WRONG:** Global variable cache with no limits
```javascript
// Leaks memory, never expires, not thread-safe
const cache = {};
function getUser(id) {
  if (cache[id]) return cache[id];
  const user = db.getUser(id);
  cache[id] = user; // grows forever!
  return user;
}
```

**RIGHT:** Structured cache with TTL and size limits
```javascript
// Bounded, expiring, safe
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 500,               // max items
  ttl: 1000 * 60 * 5,     // 5 minutes
  updateAgeOnGet: true,   // reset TTL on access
});
```

## Constraints & Scope

**In Scope:**
- In-memory key-value storage
- TTL implementation (per-key and global)
- Eviction policies (LRU, LFU, FIFO)
- Memory leak prevention
- Size limits

**Out of Scope:**
- Distributed caching (Redis, Memcached)
- Persistence to disk
- Cache warming strategies
- Multi-level caches

## Sources
- Node.js Memory Management: https://nodejs.org/en/docs/guides/memory-management/
- lru-cache package: https://www.npmjs.com/package/lru-cache
