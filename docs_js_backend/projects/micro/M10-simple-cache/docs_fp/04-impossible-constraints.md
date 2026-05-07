# Impossible Constraint: No Map, No Object, No Array

**Task:** Build a cache using only primitive values and functions.

**Constraint:** You cannot use Map, Object, Array, Set, or WeakMap.

You have: numbers, strings, booleans, functions, and closures.

---

## Your Turn

How do you store multiple key-value pairs without any data structure?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: Closures as Storage

```javascript
function createCache() {
  const entries = []; // Wait, that's an array...
}
```

You can't. Without data structures, you can't store more than one item.

**The point:** Data structures aren't optional luxuries. They're fundamental. The question isn't "should I use a Map?" It's "which Map implementation fits my constraints?"

- **Object:** Key → string only. Prototype issues.
- **Map:** Any key type. No prototype issues. Iterable.
- **WeakMap:** Object keys only. GC-friendly. Not iterable.

Each exists for a reason. Using the wrong one is like using a hammer for screws.
