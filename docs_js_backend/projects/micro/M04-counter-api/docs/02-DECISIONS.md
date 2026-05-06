# M04: Architecture Decisions

## Decision 1: Storage Backend — In-Memory vs File vs DB vs Redis

### Option A: In-Memory Counter

```typescript
let counter = 0;

export function increment(): number {
  counter += 1;
  return counter;
}
```

**Pros:**
- Fastest possible: nanoseconds
- Zero external dependencies

**Cons:**
- **Resets on server restart.** Counter goes back to 0.
- **Not shared across instances.** If you run 3 Node.js processes, each has its own counter.
- **Not shared across horizontal scaling.** Server A and Server B see different values.

**Verdict:** Unacceptable for any real system.

---

### Option B: File-Based Counter

```typescript
import { readFileSync, writeFileSync } from 'fs';

export function increment(): number {
  const current = parseInt(readFileSync('./counter.txt', 'utf8') || '0', 10);
  const next = current + 1;
  writeFileSync('./counter.txt', next.toString());
  return next;
}
```

**Pros:**
- Survives server restart
- No network dependency

**Cons:**
- **Blocks the event loop.** `readFileSync` stops the entire Node.js process.
- **Not atomic.** Two processes reading the file simultaneously get the same value.
- **Not shareable.** File is local to the machine. Does not work with multiple servers.
- **Slow.** Disk I/O is orders of magnitude slower than memory.

**Verdict:** Unacceptable for any concurrent or distributed system.

---

### Option C: Database Counter (PostgreSQL)

```sql
CREATE TABLE counter (
  id SERIAL PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- Atomic increment
UPDATE counter SET value = value + 1 WHERE id = 1 RETURNING value;
```

**Pros:**
- ACID guarantees
- Persistent
- Shareable across instances

**Cons:**
- **Slow.** A database UPDATE requires WAL (Write-Ahead Log) fsync to disk. Typical latency: 5–20 ms.
- **Lock contention.** The row lock serializes all increments. Throughput is limited by disk I/O.
- **Overkill.** We do not need relational features for a single integer.

**Verdict:** Works but is unnecessarily slow for a simple counter.

---

### Option D: Redis Counter

```typescript
export async function increment(): Promise<number> {
  return redis.incr('counter');
}
```

**Pros:**
- **Atomic.** `INCR` is a single command executed in Redis's single thread.
- **Fast.** In-memory operation: ~0.1 ms.
- **Persistent.** With AOF (`appendonly yes`), Redis fsyncs to disk. Counter survives restart.
- **Shareable.** All app instances connect to the same Redis.
- **High throughput.** Redis handles 100,000+ ops/sec on modest hardware.

**Cons:**
- Network dependency (mitigated by running Redis in the same datacenter).
- Eventual persistence (AOF fsync policy determines durability vs speed trade-off).

**Verdict:** The correct choice for this use case.

### Comparison Table

| Criterion | In-Memory | File | PostgreSQL | Redis |
|-----------|-----------|------|------------|-------|
| Speed | Nanoseconds | Milliseconds | Milliseconds | Sub-millisecond |
| Persistence | No | Yes | Yes | Yes (with AOF) |
| Shared | No | No | Yes | Yes |
| Atomic | N/A | No | Yes | Yes |
| Throughput | Unlimited | Very low | Medium | Very high |
| Complexity | None | Low | High | Low |

---

## Decision 2: Atomic Operations

### The Read-Modify-Write Anti-Pattern

```typescript
// BUGGY: Three separate operations
const current = await redis.get('counter');      // 1. READ
const value = parseInt(current || '0', 10) + 1;  // 2. MODIFY (in app memory)
await redis.set('counter', value.toString());    // 3. WRITE
```

**Why it fails:** Between step 1 and step 3, another request can execute the same sequence. Both requests read the same value, both compute the same new value, and the second write overwrites the first.

### The Atomic Solution

```typescript
// CORRECT: Single operation
return redis.incr('counter');
```

**Why it works:** Redis processes commands in a single thread. When `INCR` executes, no other command can interleave. The read, increment, and write happen as one indivisible unit.

### Redis Command Atomicity Guarantee

Redis documentation states:

> "All operations in Redis are atomic because Redis uses a single-threaded event loop to process commands." [^1]

This means:
- `INCR` is atomic.
- `DECR` is atomic.
- `INCRBY` is atomic.
- `GETSET` is atomic.
- `HINCRBY` is atomic.

Any command that reads and modifies in a single network round-trip is safe.

---

## Decision 3: Persistence Strategy

### Redis Without Persistence

```yaml
services:
  redis:
    image: redis:7-alpine
```

Counter survives as long as Redis is running. If the container restarts, counter resets to 0.

### Redis with AOF (Append-Only File)

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
```

AOF logs every write command to disk. On restart, Redis replays the log to reconstruct state.

**AOF fsync policies:**

| Policy | Behavior | Durability | Speed |
|--------|----------|------------|-------|
| `always` | fsync after every write | Maximum | Slowest |
| `everysec` | fsync once per second | Good | Fast |
| `no` | Let OS decide when to fsync | Lowest | Fastest |

Default is `everysec`, which is the sweet spot for most applications. You might lose 1 second of data on a power failure.

### Our Decision

**AOF with `appendonly yes`.** We choose durability because:
1. Losing a counter reset on restart is confusing and potentially business-critical.
2. The performance impact of `everysec` is negligible for a counter API.

[^1]: Redis Documentation. "Transactions." https://redis.io/docs/latest/develop/interact/transactions/
