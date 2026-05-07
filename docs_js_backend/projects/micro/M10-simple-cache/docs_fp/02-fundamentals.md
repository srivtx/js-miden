# Fundamentals: Implement LRU Cache from Scratch

**Task:** Build an LRU (Least Recently Used) cache using only JavaScript built-ins. No npm.

Requirements:
- Max 100 entries
- When full, evict the least recently used
- O(1) get and set

---

## Multiple Choice: Data Structure

**A)** Two arrays: one for keys, one for values. On access, move key to end.

**B)** A Map + a doubly-linked list. Map provides O(1) lookup. List provides O(1) move-to-front.

**C)** A single object with timestamps. On eviction, scan all entries to find oldest.

**D)** A Set. JavaScript Sets maintain insertion order, so you can use them as a queue.

**Think before reading on.**

---

## The Answer

**B is correct.**

- **A:** Moving an item in an array is O(n). Not acceptable.
- **B:** Map gives O(1) key lookup. Doubly-linked list gives O(1) removal and insertion at ends. Perfect.
- **C:** Scanning all entries is O(n). Not acceptable.
- **D:** Sets don't support "move to front" efficiently.

---

## The Code

```javascript
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map(); // key -> node
    this.head = { next: null, prev: null };
    this.tail = { next: null, prev: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key) {
    const node = this.cache.get(key);
    if (!node) return null;
    this.moveToFront(node);
    return node.value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      node.value = value;
      this.moveToFront(node);
      return;
    }

    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const node = { key, value, next: null, prev: null };
    this.cache.set(key, node);
    this.addToFront(node);
  }

  addToFront(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }

  moveToFront(node) {
    this.remove(node);
    this.addToFront(node);
  }

  remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  evictLRU() {
    const lru = this.tail.prev;
    this.remove(lru);
    this.cache.delete(lru.key);
  }
}
```

**Why doubly-linked list?**
- Remove a node in O(1) (update 4 pointers)
- Add to front in O(1)
- The tail always points to the LRU item
