# M10: Simple Cache — Deep Concepts

## Cache Eviction Policies

### LRU (Least Recently Used)

**Concept:** When the cache is full and a new item is inserted, evict the item that has not been accessed for the longest time.

**Implementation:** Maintain a doubly-linked list ordered by access time. On access, move the item to the front (most recent). On eviction, remove from the back (least recent).

**Example:**
```
Cache size: 3
Access: A -> [A]
Access: B -> [B, A]  (B is most recent)
Access: C -> [C, B, A]
Access: A -> [A, C, B]  (A moved to front)
Access: D -> [D, A, C]  (B evicted --- least recently used)
```

**Time Complexity:** O(1) for get and set using HashMap + DoublyLinkedList.

### LFU (Least Frequently Used)

**Concept:** Evict the item with the lowest access count.

**Implementation:** Maintain a frequency map. Items with the same frequency are ordered by recency.

**Problem:** "Cache pollution" --- a bulk scan of many items increments their counters, pushing truly hot items out.

### FIFO (First In, First Out)

**Concept:** Evict the oldest item by insertion time, regardless of access.

**Problem:** Ignores access patterns. An old but frequently accessed item can be evicted by a new item that is never accessed again.

## TTL Implementation

### Strategy 1: Per-Key Timestamps

Store the expiration time with each value. Check on every `get()`.

```javascript
class TTLCache {
  #cache = new Map();
  
  set(key, value, ttlMs) {
    const expiresAt = Date.now() + ttlMs;
    this.#cache.set(key, { value, expiresAt });
  }
  
  get(key) {
    const entry = this.#cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.#cache.delete(key);
      return undefined;
    }
    return entry.value;
  }
}
```

**Pros:** No timers, O(1) operations.
**Cons:** Expired entries linger until accessed or swept.

### Strategy 2: setTimeout per Key

Create a timer for each key that deletes it upon expiration.

```javascript
set(key, value, ttlMs) {
  this.#cache.set(key, value);
  const timer = setTimeout(() => this.#cache.delete(key), ttlMs);
  this.#timers.set(key, timer);
}
delete(key) {
  clearTimeout(this.#timers.get(key));
  this.#timers.delete(key);
  this.#cache.delete(key);
}
```

**Pros:** Immediate cleanup.
**Cons:** Many timers consume event loop memory. Missing `clearTimeout` causes leaks.

## Memory Leaks in Node.js

### What is a Memory Leak?

A memory leak occurs when allocated memory is no longer needed but is not released. In Node.js, this usually means objects are still referenced from the garbage collection root.

### Common Cache-Related Leaks

1. **Unbounded Map growth**
   ```javascript
   const cache = new Map();
   app.use((req, res) => {
     cache.set(req.ip, req.headers); // grows forever
   });
   ```

2. **Orphaned timers**
   ```javascript
   function setWithTTL(key, value, ttl) {
     cache.set(key, value);
     setTimeout(() => cache.delete(key), ttl);
     // If cache.delete(key) is called early, the timer still holds
     // references until it fires.
   }
   ```

3. **Closures capturing large objects**
   ```javascript
   const bigData = fetchHugeDataset();
   cache.set('key', {
     getData: () => bigData // closure keeps bigData alive forever
   });
   ```

### setTimeout/clearTimeout Memory Leak Diagram

```
Event Loop Timeline:
-----------------------------------------------------------------
  setTimeout(fn, 5000)
       |
       v
  [Timer 1] ---refers to---> cache ---refers to---> largeObject
       |
  clearTimeout(Timer 1)  Timer canceled, references drop
       |
  cache.delete(key) WITHOUT clearTimeout
       |
  [Timer 1] still active ---refers to---> cache (now empty?)
       |
  Even if cache is empty, the timer's closure may still
  reference the key string and the cache object itself,
  preventing garbage collection until the timer fires.
-----------------------------------------------------------------
```

**WHY:** `setTimeout` callbacks are held by the event loop's timer heap. Until the timer fires or is cleared, all variables captured in the closure remain reachable.

## WeakMap and WeakRef

### WeakMap

Keys must be objects. If the key is garbage collected, the entry is automatically removed.

```javascript
const cache = new WeakMap();
let user = { id: 1 };
cache.set(user, 'data');
user = null; // entry becomes eligible for GC
```

**Limitation:** Cannot use primitive strings as keys. Not suitable for typical string-keyed caches.

### WeakRef

A `WeakRef` allows holding a reference to an object without preventing garbage collection.

```javascript
const ref = new WeakRef(largeObject);
const obj = ref.deref(); // undefined if GC collected it
```

**Use case:** Implementing a cache where values can be GC'd under memory pressure.

### FinalizationRegistry

Runs a callback when an object is garbage collected.

```javascript
const registry = new FinalizationRegistry((key) => {
  console.log(`Object for ${key} was garbage collected`);
});
registry.register(object, key);
```

**Use case:** Cleaning up external resources (files, timers) when cached objects are GC'd.

## Event Loop Timers

Node.js uses a **min-heap** to manage timers. `setTimeout` inserts a callback into this heap. The event loop checks the heap on each iteration.

**Implication:** Thousands of active timers increase memory usage and slow down the event loop slightly, even if they haven't fired yet.

**WRONG:** Creating a `setTimeout` per cache entry in a high-throughput system.
**RIGHT:** Using timestamp-based expiration or a single sweep timer.

## Sources
- Node.js Memory Diagnostics: https://nodejs.org/en/docs/guides/diagnostics/memory/
- V8 Garbage Collection: https://v8.dev/blog/trash-talk
- WeakRef MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef
