# Three Wrong Ways to Cache

---

## Wrong #1: Object Instead of Map

```javascript
const cache = {};

cache['user:123'] = userData;
```

**Why it looks right:** Objects are key-value stores. Fast and simple.

**Why it's wrong:**
- Object keys are coerced to strings. `cache[123]` and `cache['123']` are the same.
- Prototype pollution: `cache['constructor']` or `cache['__proto__']` can break things.
- No easy way to count entries or iterate safely.

**Use Map.** It's designed for this.

---

## Wrong #2: No Expiry, No Limit

```javascript
const cache = new Map();

function getOrSet(key, factory) {
  if (!cache.has(key)) {
    cache.set(key, factory());
  }
  return cache.get(key);
}
```

**Why it looks right:** Simple cache-aside pattern. Works fine locally.

**Why it's wrong:**
- Memory grows unbounded
- Stale data persists forever
- In production, this OOMs your server

---

## Wrong #3: WeakMap for Time-Based Cache

```javascript
const cache = new WeakMap();
```

**Why it looks right:** WeakMap allows garbage collection! No memory leaks!

**Why it's wrong:**
- WeakMap keys must be objects. You can't use strings.
- WeakMap has no iteration. You can't implement LRU.
- WeakMap doesn't notify you when something is collected.

**WeakMap is for attaching private data to objects, not for general caching.**
