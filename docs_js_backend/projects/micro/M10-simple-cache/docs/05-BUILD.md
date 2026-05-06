# M10: Simple Cache — Step-by-Step Build

## Step 1: Initialize Project

```bash
mkdir m10-simple-cache && cd m10-simple-cache
npm init -y
npm install lru-cache
npm install --save-dev nodemon
```

## Step 2: Create a Basic TTL Cache with Map

Create `basic-cache.js`:
```javascript
class BasicTTLCache {
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
  
  delete(key) {
    return this.#cache.delete(key);
  }
  
  clear() {
    this.#cache.clear();
  }
  
  size() {
    return this.#cache.size;
  }
}

export default BasicTTLCache;
```

## Step 3: Add Size-Based Eviction (LRU)

Create `lru-cache-custom.js`:
```javascript
class LRUCacheCustom {
  #cache = new Map();
  #maxSize;
  
  constructor(maxSize = 100) {
    this.#maxSize = maxSize;
  }
  
  get(key) {
    if (!this.#cache.has(key)) return undefined;
    
    const value = this.#cache.get(key);
    // Move to end (most recently used)
    this.#cache.delete(key);
    this.#cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.#cache.has(key)) {
      this.#cache.delete(key);
    } else if (this.#cache.size >= this.#maxSize) {
      // Evict least recently used (first item)
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }
    this.#cache.set(key, value);
  }
  
  delete(key) {
    return this.#cache.delete(key);
  }
}

export default LRUCacheCustom;
```

**Note:** Map maintains insertion order. By deleting and re-inserting on access, we implement LRU.

## Step 4: Integrate with Express

Create `server.js`:
```javascript
import express from 'express';
import { LRUCache } from 'lru-cache';
import BasicTTLCache from './basic-cache.js';

const app = express();
const PORT = 3000;

// Option A: Use the lru-cache library
const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true,
});

// Simulated expensive database call
async function fetchUser(id) {
  await new Promise(r => setTimeout(r, 100)); // simulate latency
  return { id, name: `User ${id}`, fetchedAt: new Date().toISOString() };
}

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  
  if (cache.has(id)) {
    return res.json({ ...cache.get(id), cached: true });
  }
  
  const user = await fetchUser(id);
  cache.set(id, user);
  res.json({ ...user, cached: false });
});

app.delete('/cache/:id', (req, res) => {
  cache.delete(req.params.id);
  res.json({ deleted: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

## Step 5: Test the Cache

```bash
# First request --- cache miss
curl http://localhost:3000/users/1
# -> { id: "1", name: "User 1", fetchedAt: "...", cached: false }

# Second request --- cache hit
curl http://localhost:3000/users/1
# -> { id: "1", name: "User 1", fetchedAt: "...", cached: true }

# Wait 5 minutes --- expired
curl http://localhost:3000/users/1
# -> cached: false
```

## Step 6: Add Metrics

```javascript
let hits = 0;
let misses = 0;

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  
  if (cache.has(id)) {
    hits++;
    return res.json({ ...cache.get(id), cached: true });
  }
  
  misses++;
  const user = await fetchUser(id);
  cache.set(id, user);
  res.json({ ...user, cached: false });
});

app.get('/metrics', (req, res) => {
  const total = hits + misses;
  res.json({
    hits,
    misses,
    hitRate: total > 0 ? hits / total : 0,
    size: cache.size,
  });
});
```

## Step 7: Prevent Thundering Herd (Cache Stampede)

Create `middleware/withCache.js`:
```javascript
const locks = new Map();

export function withCache(cache, fetchFn) {
  return async (key) => {
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    // Lock: only one request should fetch
    if (locks.has(key)) {
      return locks.get(key); // return the in-flight promise
    }
    
    const promise = fetchFn(key).finally(() => {
      locks.delete(key);
    });
    
    locks.set(key, promise);
    const result = await promise;
    cache.set(key, result);
    return result;
  };
}
```

## Sources
- lru-cache Options: https://github.com/isaacs/node-lru-cache#options
- Express Middleware: https://expressjs.com/en/guide/using-middleware.html
