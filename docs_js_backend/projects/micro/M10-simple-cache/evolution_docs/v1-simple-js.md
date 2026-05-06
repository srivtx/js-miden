# v1-simple-js.md — Simple Cache

## The Naive Beginning

We needed a fast key-value cache for our API. The simplest thing is a plain object:

```javascript
// cache.js
const cache = {};

function set(key, value) {
  cache[key] = value;
}

function get(key) {
  return cache[key];
}

function del(key) {
  delete cache[key];
}

module.exports = { set, get, del };
```

## The Hidden Bug

**PAIN:** Under load, this "simple" cache becomes a production incident:

1. **Memory leak:** A plain object has no size limit. A misbehaving client (or attacker) can write millions of unique keys. The Node.js process runs out of memory and crashes with `FATAL ERROR: Reached heap limit`.
2. **No TTL:** Values live forever. Temporary session data from 3 weeks ago is still in memory.
3. **Prototype pollution:** If a key is `__proto__`, you can corrupt the object's prototype chain:
   ```javascript
   cache['__proto__'].polluted = true;
   // All objects in the process now have `polluted: true`
   ```

## Why We Added Complexity

We needed:
- **Bounded size** so memory doesn't grow forever
- **TTL (time-to-live)** so stale data expires
- **A safe data structure** (Map) that isn't vulnerable to prototype pollution

> **Lesson:** "Simple" in-memory caches are grenades in production. They work for 10 keys and destroy you at 10 million.
