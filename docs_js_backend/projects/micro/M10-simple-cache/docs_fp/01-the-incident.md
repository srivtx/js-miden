# The 3AM Page: Memory Exhaustion

It's 2:33 AM. Your monitoring screams.

**Alert:** `Memory usage 94% on API server #3`

You SSH in. `htop` shows Node.js eating 8GB RAM. The server has 8GB total. OOM killer is circling.

You check the cache code:

```javascript
const cache = new Map();

function set(key, value, ttlMs) {
  cache.set(key, { value, expiry: Date.now() + ttlMs });
}
```

No cleanup. Ever. Items are added but never removed. The cache grows until the server dies.

**The fix in production:** Restart the server. Lose all cache. Watch it fill up again.

---

## Your Turn

### Q1: Why does `Map` not clean up expired entries automatically?

Think about it. `Map` is a data structure. Is it responsible for time-based eviction?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Map is just a bucket

`Map` stores key-value pairs. It has no concept of "expiry." It doesn't run background threads. It doesn't watch the clock.

**JavaScript is single-threaded.** There's no background garbage collector for Maps. If you add items, they stay until you remove them or the process dies.

### The Orphaned Timer Problem

The naive fix:
```javascript
function set(key, value, ttlMs) {
  cache.set(key, value);
  setTimeout(() => cache.delete(key), ttlMs);
}
```

**What's wrong:**
- Each entry creates a `setTimeout`. 1 million entries = 1 million timers.
- `setTimeout` holds a reference to the closure, which holds the value. The value can't be garbage collected until the timer fires.
- If you overwrite a key, the old timer still fires and tries to delete... what?

### The Real Fix

**Lazy eviction:** Check expiry on access. Don't clean up proactively.

```javascript
function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
```

**Or use a real LRU cache** (like `lru-cache`) that handles eviction properly.
