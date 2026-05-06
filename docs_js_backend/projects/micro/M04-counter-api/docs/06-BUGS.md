# M04: Bug Deep Dive — Read-Modify-Write Race Condition

## The Bug

The `increment()` function reads the current counter value from Redis, increments it in the Node.js process memory, and writes it back. This creates a **race condition window** where concurrent requests interleave and overwrite each other's updates.

### Buggy Code

```typescript
export async function increment(): Promise<number> {
  const current = await redis.get('counter');       // 1. READ
  const value = parseInt(current || '0', 10) + 1;   // 2. MODIFY (in app)
  await redis.set('counter', value.toString());     // 3. WRITE
  return value;
}
```

## Why Read-Then-Write Fails: A Detailed Timeline

Consider two requests arriving at the same time:

```
Request A                               Request B
──────────                              ──────────

await redis.get('counter')
    │
    ▼
Redis returns "5"
    │
    ▼
parseInt("5") + 1 = 6
    │
    │                                   await redis.get('counter')
    │                                       │
    │                                       ▼
    │                                   Redis returns "5" (same value!)
    │                                       │
    │                                       ▼
    │                                   parseInt("5") + 1 = 6
    │                                       │
    ▼                                       │
await redis.set('counter', '6')
    │                                       │
    ▼                                       │
Redis stores 6                            │
    │                                       │
    │                                       ▼
    │                                   await redis.set('counter', '6')
    │                                       │
    │                                       ▼
    │                                   Redis stores 6 (OVERWRITE!)
    │                                       │
    ▼                                       ▼
return 6                                return 6

Expected: count = 7 (5 → 6 → 7)
Actual:   count = 6 (5 → 6, then 6 again)
Lost:     1 increment
```

**The root cause:** Both requests read the value before either writes. They both compute `6` and both write `6`. The second write is not "6 + 1"; it is just "6", overwriting the first increment.

### Visualizing the Window

```
Time ──▶

Request A:  [====READ====][====COMPUTE====][====WRITE====]
Request B:              [====READ====][====COMPUTE====][====WRITE====]
                                    ↑
                         RACE WINDOW: Both have read 5,
                         neither has written yet.
```

Any request that enters during the race window reads the same stale value.

---

## Scale of the Problem

### With 2 Concurrent Requests

| Probability of overlap | Lost increments | Final count (starting at 0) |
|------------------------|-----------------|------------------------------|
| High (same event loop tick) | 1 | 1 (should be 2) |
| Low (sequential by chance) | 0 | 2 |

### With 100 Concurrent Requests

```
All 100 requests read 0 → compute 1 → write 1.
Result: 100 requests, final count = 1.
Worst case: 99 lost increments.
```

In practice, network jitter and event loop timing mean some requests see each other's writes:

```
Batch 1 (requests 1-30):  read 0  → write 1
Batch 2 (requests 31-60): read 1  → write 2
Batch 3 (requests 61-90): read 2  → write 3
Batch 4 (requests 91-100):read 3  → write 4

Final count: ~4 (96 lost increments)
```

This is exactly what the load test demonstrates. The exact final count varies per run, but it is always significantly less than 1000.

---

## Why This Bug Is Insidious

### 1. It Works in Development

```bash
# Sequential requests — bug is invisible
curl -X POST http://localhost:3000/increment  # 1
curl -X POST http://localhost:3000/increment  # 2
curl -X POST http://localhost:3000/increment  # 3
```

Sequential requests have no overlap. The bug only appears with true concurrency.

### 2. No Errors Are Thrown

The code does not crash. It does not log exceptions. It returns HTTP 200 with a JSON body. Everything looks fine — the data is just wrong.

### 3. The Failure Is Probabilistic

The number of lost increments depends on:
- Network latency variance
- Event loop scheduling
- Redis server load
- Number of concurrent clients

Two runs with identical parameters can produce different results. This makes debugging extremely frustrating.

---

## The Fix: Atomic INCR

```typescript
export async function increment(): Promise<number> {
  return redis.incr('counter');
}
```

### Why INCR Is Atomic

Redis processes all commands in a single thread:

```
Redis Event Loop:

Time ──▶

[Process Request A's INCR]
  1. Read value (0)
  2. Increment (1)
  3. Write value (1)
  4. Respond "1"

[Process Request B's INCR]
  1. Read value (1)
  2. Increment (2)
  3. Write value (2)
  4. Respond "2"

No overlap. No window. Every increment is counted.
```

### INCR Under 1000 Concurrent Requests

```
Client A: INCR ──▶ Redis ──▶ 1
Client B: INCR ──▶ Redis ──▶ 2
Client C: INCR ──▶ Redis ──▶ 3
...
Client ZZZ: INCR ──▶ Redis ──▶ 1000

Final count: exactly 1000
```

Even though 1000 clients sent requests "simultaneously," Redis queues them and processes each INCR atomically.

---

## Alternative Fixes (If INCR Were Not Available)

### Fix 1: Lua Scripting

```typescript
const script = `
  local current = redis.call('get', KEYS[1]) or 0
  local next = tonumber(current) + 1
  redis.call('set', KEYS[1], next)
  return next
`;

export async function increment(): Promise<number> {
  return redis.eval(script, 1, 'counter') as Promise<number>;
}
```

**Why it works:** Redis executes Lua scripts atomically. No other command runs during script execution.

**Trade-off:** Harder to read and maintain than `INCR`.

### Fix 2: Redis Transactions (WATCH/MULTI/EXEC)

```typescript
export async function increment(): Promise<number> {
  await redis.watch('counter');
  const current = await redis.get('counter');
  const next = parseInt(current || '0', 10) + 1;
  
  const multi = redis.multi();
  multi.set('counter', next.toString());
  const results = await multi.exec();
  
  if (results === null) {
    // Transaction failed because key was modified during watch
    return increment(); // Retry
  }
  
  return next;
}
```

**Why it works:** `WATCH` monitors the key. If any other client modifies it before `EXEC`, the transaction aborts and returns `null`. The function retries.

**Trade-off:** Complex, requires retry logic, and is slower than `INCR`.

### Fix 3: Database Row Lock (PostgreSQL)

```sql
UPDATE counters SET value = value + 1 WHERE id = 1 RETURNING value;
```

**Why it works:** The database locks the row for the duration of the UPDATE. No other transaction can read the old value.

**Trade-off:** Slower than Redis (disk I/O, transaction overhead).

### Why INCR Is Best

| Fix | Lines of Code | Complexity | Performance | Correctness |
|-----|---------------|------------|-------------|-------------|
| INCR | 1 | Minimal | Fastest | Guaranteed |
| Lua | 6 | Medium | Fast | Guaranteed |
| WATCH/MULTI/EXEC | 12 | High | Slower (retries) | Guaranteed (with retry) |
| PostgreSQL UPDATE | 1 SQL | Low | Slower | Guaranteed |

**INCR is the optimal solution:** It is the simplest, fastest, and most reliable.

---

## Prevention Strategies

### 1. Always Ask: "Can Another Request Interleave Here?"

When you see this pattern:

```typescript
const x = await read(key);
const y = transform(x);
await write(key, y);
```

**Alarm bells should ring.** Any read-modify-write across a network boundary is suspect.

### 2. Look for Atomic Alternatives

Before writing read-modify-write, check if your datastore provides an atomic operation:

| Datastore | Atomic Increment | Atomic Append | Atomic Compare-and-Swap |
|-----------|------------------|---------------|-------------------------|
| Redis | `INCR`, `INCRBY` | `LPUSH`, `RPUSH` | `SET NX` |
| PostgreSQL | `UPDATE ... + 1` | N/A | `UPDATE ... WHERE value = $old` |
| MongoDB | `$inc` | `$push` | `findAndModify` |
| DynamoDB | `ADD` | `SET list_append` | `ConditionExpression` |

### 3. Load Test Everything

The counter bug is invisible without concurrency testing. Every endpoint that modifies shared state should have a concurrent load test.

```typescript
test('concurrent safety', async () => {
  const promises = Array.from({ length: 100 }, () => increment());
  await Promise.all(promises);
  const count = await getCount();
  assert.strictEqual(count, 100);
});
```
