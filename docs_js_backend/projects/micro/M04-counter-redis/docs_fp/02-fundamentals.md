# M04 Counter Redis: Fundamentals

## 1. What Is a Distributed Counter?

A counter that multiple processes, servers, or threads can increment or decrement reliably, with every operation reflected correctly in the final value.

In a single-process app:
```javascript
let count = 0;
count++; // Always correct. Only one thread of execution.
```

In a distributed system:
```javascript
// Server A
const current = await redis.get('counter');
// Server B
const current = await redis.get('counter');
// Both read 5. Both write 6. One increment lost.
```

## 2. Atomicity

An operation is **atomic** if it executes completely or not at all, with no observable intermediate state.

| Pattern | Atomic? | Why |
|---------|---------|-----|
| `count++` in a single thread | ✅ Yes | No interruption possible |
| `GET` → `SET` in Redis | ❌ No | Another client can interleave |
| `INCR` in Redis | ✅ Yes | Server-side, single-threaded execution |
| `MULTI` / `EXEC` in Redis | ✅ Yes | Transaction queue, no interleaving |
| Lua script in Redis | ✅ Yes | Executed atomically by the Redis engine |

## 3. Redis as a Counter Store

Redis stores values as strings but provides integer-aware commands:

| Command | What it does | Returns |
|---------|--------------|---------|
| `INCR key` | Atomically increment by 1 | New value |
| `DECR key` | Atomically decrement by 1 | New value |
| `INCRBY key N` | Atomically increment by N | New value |
| `DECRBY key N` | Atomically decrement by N | New value |

All of these are **O(1)** and atomic because Redis is single-threaded. It processes one command at a time.

## 4. Read-Modify-Write: The Silent Killer

```javascript
// NOT ATOMIC
const current = await redis.get('counter');      // Step 1: Read
const next = parseInt(current, 10) + 1;          // Step 2: Modify
await redis.set('counter', next.toString());     // Step 3: Write
```

Between Step 1 and Step 3, any number of other clients can perform the same sequence. The classic **lost update** problem.

### Visual Timeline

```
Time →  ──────────────────────────────────────────►

Client A:  [GET: 5]        [compute 6]  [SET: 6]
Client B:            [GET: 5]        [compute 6]  [SET: 6]

Result: counter = 6 (should be 7)
```

## 5. When You Need More Than INCR

`INCR` and `DECR` are perfect for +1 and -1. But what if the logic is conditional?

**Example:** "Decrement inventory by 3, but only if at least 3 remain."

Redis alone cannot express this in one command. Solutions:

### Option A: Lua Script (Atomic, Server-Side)
```lua
local current = tonumber(redis.call('GET', KEYS[1])) or 0
local delta = tonumber(ARGV[1])
if current >= delta then
  redis.call('DECRBY', KEYS[1], delta)
  return current - delta
else
  return -1
end
```

### Option B: WATCH / MULTI / EXEC (Optimistic Locking)
```javascript
await redis.watch('inventory');
const current = await redis.get('inventory');
if (parseInt(current) >= 3) {
  await redis.multi()
    .decrby('inventory', 3)
    .exec();
} else {
  await redis.unwatch();
}
```

If another client modifies `inventory` between `WATCH` and `EXEC`, the transaction aborts.

## 6. Failure Modes

| Failure | Effect | Mitigation |
|---------|--------|------------|
| Redis unreachable | Counter reads/writes fail | Return 503, do not serve stale data |
| Network partition | Split-brain: two servers think they own the counter | Redis Sentinel or Cluster for HA |
| Counter key deleted | `GET` returns `null` | Treat null as `0`, or alert |
| Integer overflow | Redis uses 64-bit signed ints | Max value is 9,223,372,036,854,775,807 — unlikely in practice |

## 7. The Fundamental Truth

> In distributed systems, **composition is the enemy of correctness**. Two correct operations composed sequentially (`GET` then `SET`) create an incorrect system. The only safe compositions are those guaranteed by the platform: transactions, Lua scripts, and single atomic commands.
