# M10: Simple Cache — Bug Deep Dive

## Bug 1: Orphaned Timers (Memory Leak)

**WHAT:** Using `setTimeout` for TTL without storing and clearing the timer reference.

**Reproduction:**
```javascript
class BadCache {
  #cache = new Map();
  
  set(key, value, ttl) {
    this.#cache.set(key, value);
    setTimeout(() => this.#cache.delete(key), ttl); // Orphaned!
  }
  
  delete(key) {
    this.#cache.delete(key);
    // Timer is NOT cleared --- it will still fire and try to delete!
  }
}
```

**Root Cause:** `setTimeout` registers a callback in the event loop's timer heap. The closure captures `this.#cache` and `key`. Even after `cache.delete(key)`, the timer still holds a reference to the cache object until it fires. In a high-throughput system with millions of keys, this creates millions of timer entries.

**Memory Impact:** Each active timer in the heap consumes ~100-200 bytes. 1M timers = ~150MB of timer overhead alone.

**WRONG:**
```javascript
setTimeout(() => cache.delete(key), ttl);
// No reference to timer, cannot clear
```

**RIGHT:**
```javascript
class GoodCache {
  #cache = new Map();
  #timers = new Map();
  
  set(key, value, ttl) {
    this.clearTimer(key);
    this.#cache.set(key, value);
    const timer = setTimeout(() => {
      this.#cache.delete(key);
      this.#timers.delete(key);
    }, ttl);
    this.#timers.set(key, timer);
  }
  
  delete(key) {
    this.clearTimer(key);
    this.#cache.delete(key);
  }
  
  clearTimer(key) {
    const timer = this.#timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.#timers.delete(key);
    }
  }
}
```

**Better RIGHT:** Avoid per-key timers entirely. Use timestamp comparison.

```javascript
class BetterCache {
  #cache = new Map();
  
  set(key, value, ttl) {
    this.#cache.set(key, { value, expiresAt: Date.now() + ttl });
  }
  
  get(key) {
    const entry = this.#cache.get(key);
    if (entry && Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      return undefined;
    }
    return entry?.value;
  }
}
```

## Bug 2: Unbounded Map Growth (OOM)

**WHAT:** A cache without a size limit grows until the Node.js process runs out of memory.

**Reproduction:**
```javascript
const cache = new Map();

app.get('/search', (req, res) => {
  const query = req.query.q;
  if (!cache.has(query)) {
    cache.set(query, db.search(query)); // grows with every unique query
  }
  res.json(cache.get(query));
});
```

**Attack:** An attacker sends millions of unique queries:
```bash
for i in {1..1000000}; do curl "/search?q=$i"; done
```

**Result:** The Map grows by 1M entries. Node.js heap limit is reached. Process crashes with `FATAL ERROR: Reached heap limit Allocation failed`.

**WRONG:**
```javascript
const cache = new Map(); // No max size!
```

**RIGHT:**
```javascript
import { LRUCache } from 'lru-cache';
const cache = new LRUCache({ max: 1000 }); // Hard limit
```

## Bug 3: Mutable Value Corruption

**WHAT:** Modifying a cached object by reference corrupts the cache.

**Reproduction:**
```javascript
const cache = new LRUCache({ max: 100 });

function getConfig() {
  if (cache.has('config')) return cache.get('config');
  const config = { timeout: 30, retries: 3 };
  cache.set('config', config);
  return config;
}

const config = getConfig();
config.timeout = 9999; // Mutates the cached object!

const config2 = getConfig();
console.log(config2.timeout); // 9999 --- corrupted!
```

**WRONG:** Returning mutable objects directly from cache.

**RIGHT:** Return clones (shallow or deep, depending on needs).
```javascript
import structuredClone from 'structuredClone'; // Node 17+ native

function getConfig() {
  if (cache.has('config')) {
    return structuredClone(cache.get('config')); // return a copy
  }
  const config = { timeout: 30, retries: 3 };
  cache.set('config', structuredClone(config));
  return config;
}
```

## Bug 4: Stale Data with No Invalidation

**WHAT:** Data is updated in the database but the cache serves old data indefinitely.

**Reproduction:**
```javascript
// User updates their profile
db.query('UPDATE users SET name = ? WHERE id = ?', ['New Name', 1]);

// But cache still has old name
cache.get('user:1'); // { name: 'Old Name' }
```

**WRONG:** Setting cache without a TTL or invalidation mechanism.

**RIGHT:**
```javascript
// Option 1: TTL
const cache = new LRUCache({ ttl: 60000 }); // expires in 1 minute

// Option 2: Explicit invalidation on write
function updateUser(id, data) {
  db.query('UPDATE users SET ... WHERE id = ?', [id]);
  cache.delete(`user:${id}`); // invalidate cache
}
```

## Sources
- Node.js Memory Limits: https://nodejs.org/api/process.html#process_process_memoryusage
- lru-cache Size Management: https://github.com/isaacs/node-lru-cache#max
