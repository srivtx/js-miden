# M04: Thinking Process — Mental Models, Hot Path, Danger Zones

## Mental Model: The Ticket Window

Imagine a concert with a single ticket window (Redis) and hundreds of people (HTTP requests) trying to buy tickets.

### The Wrong Way (Read-Modify-Write)

```
Customer A: "How many tickets left?"  → Clerk: "100"
Customer B: "How many tickets left?"  → Clerk: "100"  (same moment!)

Customer A: "I'll take one."          → Clerk writes: 99
Customer B: "I'll take one."          → Clerk writes: 99  (A's purchase was ignored!)

Result: 2 customers served, count went from 100 → 99. Lost sale.
```

### The Right Way (Atomic Operation)

```
Customer A: "Give me one ticket."     → Clerk atomically decrements: 99
Customer B: "Give me one ticket."     → Clerk atomically decrements: 98

Result: 2 customers served, count went from 100 → 98. No lost sales.
```

**The key insight:** The "read" and "write" must happen as a single, indivisible operation. The clerk must not answer "how many left?" as a separate step from "subtract one."

---

## The Hot Path

The hot path for `POST /increment` is:

```
Request arrives → Express parses → Call increment() → Redis INCR → Return JSON
```

**Redis INCR latency:**
- Local Redis: ~0.1–0.5 ms
- Networked Redis (same AZ): ~0.5–2 ms
- Networked Redis (cross-region): ~10–50 ms

The entire HTTP request typically completes in **1–5 ms** when Redis is local. This is fast enough to handle thousands of requests per second on a single Node.js instance.

### Why Node.js Handles This Well

Node.js uses an event loop and non-blocking I/O. While waiting for Redis to respond, the CPU is free to handle other requests:

```
Event Loop Timeline (simplified):

T+0ms:   Req A arrives → sends INCR to Redis → yields
T+0.1ms: Req B arrives → sends INCR to Redis → yields
T+0.2ms: Req C arrives → sends INCR to Redis → yields
...
T+1ms:   Redis responds to A → callback runs → response sent
T+1.1ms: Redis responds to B → callback runs → response sent
```

A single Node.js thread can handle thousands of concurrent INCR operations because it is I/O-bound, not CPU-bound.

---

## Danger Zones

### Danger Zone 1: The Race Condition Window

The read-modify-write pattern has a **window of vulnerability** between GET and SET:

```
Time ──────────────────────────────────────────────────────▶

  Request A: GET counter → 5
       │
       │     Request B: GET counter → 5  (same value!)
       │          │
       │          ▼
       │     Request B: compute 5 + 1 = 6
       │          │
       ▼          │
  Request A: compute 5 + 1 = 6
       │          │
       ▼          ▼
  Request A: SET counter = 6
       │          │
       │          ▼
       │     Request B: SET counter = 6  (OVERWRITES A!)
       │          │
       │          ▼
       │     Final count: 6 (should be 7)
       │
       └── Lost increment: A's increment was overwritten
```

**The window exists because GET and SET are two separate network round-trips.** Even if your Node.js code looks sequential, multiple requests interleave between those two operations.

### Danger Zone 2: Naive File-Based Counter

Some developers try to solve this with a file:

```typescript
// WRONG: File-based counter
const current = readFileSync('./counter.txt', 'utf8');
const next = parseInt(current) + 1;
writeFileSync('./counter.txt', next.toString());
```

**Why this is worse:**
1. File I/O is slow (~1–10 ms for SSD, ~100 ms for spinning disk).
2. `readFileSync` blocks the entire Node.js event loop. No other request can process while reading.
3. Even with `fs.promises`, file systems do not guarantee atomic read-modify-write across processes.
4. Two Node.js instances (horizontal scaling) cannot share a local file.

### Danger Zone 3: Database Counter Without Atomicity

```typescript
// WRONG: Even PostgreSQL can race if you do this
const result = await db.query('SELECT value FROM counter WHERE id = 1');
const next = result.rows[0].value + 1;
await db.query('UPDATE counter SET value = $1 WHERE id = 1', [next]);
```

This has the exact same race condition as Redis read-modify-write. The fix in PostgreSQL is:

```sql
UPDATE counter SET value = value + 1 WHERE id = 1;
```

This is atomic because the UPDATE is a single statement. But it requires a database transaction and row lock, which is slower than Redis INCR.

### Danger Zone 4: Connection Loss During INCR

```
Client sends INCR → Network partition → Client never receives response
       │
       ▼
Redis DID increment, but client does not know.
Client retries → Counter increments again → Overcount!
```

**Mitigation:** For idempotency-critical systems, use a request ID and Lua scripting:

```lua
-- Only increment if we haven't seen this request ID before
if redis.call('sismember', 'processed_requests', ARGV[1]) == 0 then
  redis.call('sadd', 'processed_requests', ARGV[1]);
  return redis.call('incr', KEYS[1]);
else
  return redis.call('get', KEYS[1]);
end
```

This is beyond the scope of this project but is essential for financial counters.

---

## What-If Scenarios

### What if we need to increment by more than 1?

Use `INCRBY`:

```typescript
await redis.incrby('counter', 5);  // Atomically adds 5
```

### What if we need to set a maximum value?

Use Lua scripting for atomic compare-and-increment:

```lua
local current = redis.call('get', KEYS[1]) or 0;
if tonumber(current) < tonumber(ARGV[1]) then
  return redis.call('incr', KEYS[1]);
else
  return -1;  -- indicates max reached
end
```

### What if Redis is down?

Our code returns `503`. This is correct. **Never fake data.** If Redis is the source of truth and it is unavailable, the service is unavailable.

```typescript
app.post('/increment', async (_req, res) => {
  try {
    const count = await increment();
    res.json({ count });
  } catch (_err) {
    res.status(503).json({ error: 'Redis unavailable' });
  }
});
```

### What if we have multiple app servers?

This is exactly why Redis is necessary. With in-memory counters:

```
Server A: counter = 42 in RAM
Server B: counter = 42 in RAM

Request to A: increment → 43 (in A's RAM only)
Request to B: increment → 43 (in B's RAM only)

Final state: A=43, B=43, but true count should be 44.
```

Redis acts as the **single source of truth** shared by all servers.
