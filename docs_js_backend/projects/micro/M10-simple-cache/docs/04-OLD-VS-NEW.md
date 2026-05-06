# M10: Simple Cache — Old vs Modern

## Era 1: Global Variables (Pre-2010)

**WHAT:** Storing cached data in global variables or module-level objects.

```javascript
// OLD WAY --- no bounds, no expiration, prototype pollution risk
const cache = {};

function getUser(id) {
  if (cache[id]) {
    return cache[id];
  }
  const user = db.query('SELECT * FROM users WHERE id = ?', [id]);
  cache[id] = user;
  return user;
}
```

**Problems:**
- No size limit -> unbounded memory growth.
- No TTL -> stale data persists forever.
- `__proto__` and `constructor` keys can pollute the prototype.
- No eviction strategy.

## Era 2: Map (ES6 / Node 6+)

**WHAT:** Using native `Map` for key-value storage.

```javascript
// Better, but still manual
const cache = new Map();

function getUser(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  const user = db.query('SELECT * FROM users WHERE id = ?', [id]);
  cache.set(id, user);
  if (cache.size > 1000) {
    // Manual eviction --- usually FIFO by iterating keys
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  return user;
}
```

**Problems:**
- Manual TTL implementation required.
- Manual eviction logic is error-prone.
- No built-in access-order tracking for LRU.

## Era 3: LRU Cache Library (Modern)

**WHAT:** Using the battle-tested `lru-cache` package.

```javascript
// MODERN WAY --- bounded, TTL, LRU eviction, thread-safe
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 500,                    // maximum number of items
  ttl: 1000 * 60 * 5,          // 5 minutes
  updateAgeOnGet: true,        // reset TTL on access
  allowStale: false,           // don't return expired data
  updateAgeOnHas: false,
});

function getUser(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  const user = db.query('SELECT * FROM users WHERE id = ?', [id]);
  cache.set(id, user);
  return user;
}
```

**Advantages:**
- **Bounded:** `max` prevents OOM.
- **Self-managing TTL:** Entries expire automatically.
- **LRU eviction:** Hot data stays, cold data is removed.
- **High performance:** Written in optimized JavaScript, used by npm, yarn, and Node.js itself.

## Comparison Table

| Feature | Global Object | Map | lru-cache |
|---------|--------------|-----|-----------|
| Size Limit | None | Manual | Configurable |
| TTL Support | None | Manual | Built-in |
| LRU Eviction | None | Manual | O(1) |
| Thread Safety | None | None | Safe for single event loop |
| Memory Safety | Prototype pollution | Safe | Safe |
| TypeScript | None | Native | Native |

## Migration Path

1. Audit all global objects used for caching.
2. Replace with `Map` if the codebase is old (intermediate step).
3. Replace `Map` with `LRUCache` from `lru-cache`.
4. Add `max` and `ttl` configurations.
5. Remove manual eviction and timer code.
6. Add metrics (hit rate, evictions) using the library's `onEviction` hook.

## WRONG vs RIGHT

**WRONG:** Continuing to use plain objects for caching.
```javascript
const cache = {}; // Leaks memory, no expiration
```

**RIGHT:** Using `lru-cache` with explicit limits.
```javascript
const cache = new LRUCache({ max: 1000, ttl: 60000 });
```

## Sources
- lru-cache GitHub: https://github.com/isaacs/node-lru-cache
- ES6 Map MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
