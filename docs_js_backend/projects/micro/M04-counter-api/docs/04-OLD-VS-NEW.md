# M04: Old vs Modern

## Read-Modify-Write vs Atomic Operations

### The Old Way: Read-Modify-Write

Before developers understood distributed concurrency, read-modify-write was the natural approach:

```typescript
// Old pattern (pre-2010s thinking, still common today)
async function incrementCounter(): Promise<number> {
  // Step 1: Fetch current value from database
  const row = await db.query('SELECT value FROM counters WHERE id = 1');
  const current = row.rows[0].value;
  
  // Step 2: Increment in application code
  const next = current + 1;
  
  // Step 3: Write back
  await db.query('UPDATE counters SET value = $1 WHERE id = 1', [next]);
  
  return next;
}
```

**Why this was common:**
1. It maps directly to how humans think: "get the number, add one, save it."
2. Early web applications were single-threaded or low-traffic, so races were rare.
3. Many tutorials taught CRUD patterns without mentioning concurrency.

**Why it fails:** The database lock is released after `SELECT` and before `UPDATE`. Another transaction can read the same value in that window.

---

### The Modern Way: Atomic Operations

```typescript
// Modern pattern: Let the database do the math
async function incrementCounter(): Promise<number> {
  const result = await db.query(
    'UPDATE counters SET value = value + 1 WHERE id = 1 RETURNING value'
  );
  return result.rows[0].value;
}
```

Or with Redis:

```typescript
// Modern pattern: Single atomic command
async function incrementCounter(): Promise<number> {
  return redis.incr('counter');
}
```

**Why this is better:**
1. **No race window.** The update happens in a single statement/command.
2. **Less network traffic.** One round-trip instead of two.
3. **Less code.** Fewer lines = fewer bugs.
4. **Database optimization.** The database engine can optimize `value + 1` better than separate read/write.

---

## Side-by-Side: The Bug and The Fix

### Old/Buggy Code

```typescript
import { Redis } from 'ioredis';

const redis = new Redis();

/**
 * BUG: Read-modify-write race condition.
 * Two concurrent requests read the same value,
 * both increment, both write the same result.
 */
export async function increment(): Promise<number> {
  const current = await redis.get('counter');    // READ
  const value = parseInt(current || '0', 10) + 1; // MODIFY
  await redis.set('counter', value.toString());   // WRITE
  return value;
}

export async function getCount(): Promise<number> {
  const value = await redis.get('counter');
  return parseInt(value || '0', 10);
}
```

### Modern/Fixed Code

```typescript
import { Redis } from 'ioredis';

const redis = new Redis();

/**
 * FIXED: Redis INCR is atomic.
 * Single command. No race condition.
 */
export async function increment(): Promise<number> {
  return redis.incr('counter');  // READ + MODIFY + WRITE in one command
}

export async function getCount(): Promise<number> {
  const value = await redis.get('counter');
  return parseInt(value || '0', 10);
}
```

### Performance Comparison

| Metric | Read-Modify-Write | Atomic INCR |
|--------|-------------------|-------------|
| Network round-trips | 2 (GET + SET) | 1 (INCR) |
| Race condition risk | High | None |
| Lines of code | 3 | 1 |
| Latency (local Redis) | ~0.4 ms | ~0.2 ms |
| Throughput | Limited by race retries | Maximum Redis throughput |

---

## Callbacks vs Async/Await

### The Old Way: Callbacks (Node.js 2009–2015)

```typescript
// Callback-based Redis client (node_redis v2 style)
import redis from 'redis';
const client = redis.createClient();

function incrementCounter(callback: (err: Error | null, value?: number) => void) {
  client.get('counter', (err, current) => {
    if (err) { callback(err); return; }
    
    const value = parseInt(current || '0', 10) + 1;
    
    client.set('counter', value.toString(), (err) => {
      if (err) { callback(err); return; }
      
      callback(null, value);
    });
  });
}

// Usage
incrementCounter((err, value) => {
  if (err) console.error(err);
  else console.log('New count:', value);
});
```

**Problems:**
1. **Callback hell.** Nested callbacks for sequential operations. At 3 levels deep, code becomes unreadable.
2. **Error handling duplication.** Every callback must check `if (err)`.
3. **No return values.** You cannot `return` a value from a callback-based function; you must pass it to the next callback.
4. **No Promise composition.** You cannot use `Promise.all`, `Promise.race`, or `async/await`.

---

### The Modern Way: Async/Await (Node.js 2017+)

```typescript
// Modern ioredis with async/await
import { Redis } from 'ioredis';
const redis = new Redis();

async function incrementCounter(): Promise<number> {
  return redis.incr('counter');
}

// Usage
const value = await incrementCounter();
console.log('New count:', value);
```

**Advantages:**
1. **Flat code.** Reads like synchronous code.
2. **Centralized error handling.** `try/catch` blocks instead of `if (err)` at every level.
3. **Composable.** `Promise.all([incrA(), incrB()])` runs operations in parallel.
4. **Type-safe.** TypeScript can infer `Promise<number>` return types.

---

## Side-by-Side: Error Handling

### Callback Error Handling

```typescript
client.get('counter', (err, current) => {
  if (err) {
    console.error('GET failed:', err);
    return;
  }
  
  client.set('counter', '1', (err) => {
    if (err) {
      console.error('SET failed:', err);
      return;
    }
    
    console.log('Success');
  });
});
```

### Async/Await Error Handling

```typescript
try {
  const current = await redis.get('counter');
  await redis.set('counter', '1');
  console.log('Success');
} catch (err) {
  console.error('Operation failed:', err);
}
```

The `try/catch` is cleaner, less repetitive, and harder to forget.

---

## Modern Redis Client Evolution

| Era | Library | Pattern | Characteristics |
|-----|---------|---------|-----------------|
| 2009–2015 | `node_redis` | Callbacks | Fast, widely used, callback hell |
| 2015–2020 | `node_redis` + `bluebird.promisifyAll` | Promises | Awkward promisification wrapper |
| 2017–present | `ioredis` | Native Promises | Built-in Promise support, clustering, Sentinel |
| 2020–present | `redis` (v4) | Native Promises | Official Redis client rewritten with Promise support |

**Our choice:** `ioredis` because it is mature, feature-rich, and has excellent TypeScript support.
