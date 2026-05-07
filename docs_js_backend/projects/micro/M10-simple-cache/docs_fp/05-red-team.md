# Red Team: Attacking Caches

---

## Attack 1: Cache Poisoning

**The code:**
```javascript
app.get('/user/:id', async (req, res) => {
  const id = req.params.id;
  if (!cache.has(id)) {
    cache.set(id, await db.users.findById(id));
  }
  res.json(cache.get(id));
});
```

**Your attack:**
1. Request `/user/1` — gets cached
2. As admin, update user 1's data
3. Request `/user/1` again — gets stale cached data
4. The cache never invalidates

**Impact:** Stale data, security issues (old permissions), inconsistent state.

**Defense:** TTL, explicit invalidation, or cache-aside with write-through.

---

## Attack 2: Cache Key Collision

**The code:**
```javascript
const key = `${userId}-${query}`;
cache.set(key, results);
```

**Your attack:**
1. User ID: `1`, Query: ` OR 1=1`
2. Key becomes: `1- OR 1=1`
3. Another user: `1- OR`, Query: `1=1`
4. Same key! Data leak between users.

**Impact:** Cross-user data exposure.

**Defense:** Use structured keys (JSON) or hash the key.

---

## Attack 3: Memory Exhaustion

**The code:**
```javascript
const cache = new Map();
app.post('/search', (req, res) => {
  const query = req.body.query;
  if (!cache.has(query)) {
    cache.set(query, expensiveSearch(query));
  }
  res.json(cache.get(query));
});
```

**Your attack:**
1. Send 1 million unique search queries
2. Each gets cached
3. Server runs out of memory
4. Denial of service

**Impact:** OOM crash, service unavailable.

**Defense:** Max cache size, LRU eviction, query length limits.
