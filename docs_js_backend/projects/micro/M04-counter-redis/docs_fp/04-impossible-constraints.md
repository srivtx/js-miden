# M04 Counter Redis: Impossible Constraints

## Constraint 1: "It Must Be Exactly Correct, But Also Handle 100,000 Concurrent Writes"

### Why It Sounds Impossible
Strong consistency and massive write throughput are traditionally enemies. Database row locks serialize writes. You get correctness, but throughput collapses to ~100 ops/sec.

### The Solution
Redis is **single-threaded**. It processes one command at a time. This sounds like a bottleneck, but because it is in-memory and non-blocking for I/O, it handles **100,000+ ops/sec** on a single core.

The key insight: **single-threaded execution is not a bug; it is a consistency model.** By processing commands sequentially, Redis guarantees atomicity for free. No locks. No transactions. Just one command = one atomic unit.

```
Client A: INCR counter → processed
Client B: INCR counter → waits microseconds
Client C: INCR counter → waits microseconds

Result: counter is exactly correct. Throughput is 100k/sec.
```

---

## Constraint 2: "I Need Conditional Logic, But It Must Stay Atomic"

### Why It Sounds Impossible
`INCR` and `DECR` are atomic, but they are unconditional. What if you need: "Decrement by 5, but only if the current value is at least 5"?

Redis has no native "conditional decrement" command.

### The Solution: Lua Scripts
Redis can execute Lua scripts atomically. The entire script runs as a single command — no interleaving.

```lua
local current = tonumber(redis.call('GET', KEYS[1])) or 0
local delta = tonumber(ARGV[1])

if current >= delta then
  redis.call('DECRBY', KEYS[1], delta)
  return current - delta
else
  return -1 -- signal: insufficient inventory
end
```

From the client's perspective, this script is just one command:
```javascript
const result = await redis.eval(luaScript, 1, 'inventory:123', 5);
if (result === -1) {
  return res.status(409).json({ error: 'Insufficient inventory' });
}
```

> Lua scripting turns Redis from a key-value store into a **custom atomic compute engine**.

---

## Constraint 3: "I Cannot Lose Data If Redis Restarts"

### Why It Sounds Impossible
Redis is in-memory. Power loss = data loss. Right?

### The Solution: AOF and RDB
Redis provides two persistence mechanisms:

| Mechanism | How | Trade-off |
|-----------|-----|-----------|
| **RDB** | Snapshot the dataset to disk periodically | Fast recovery, but loses data since last snapshot |
| **AOF** | Append every write command to a log file | Near-zero data loss, but larger file, slower recovery |
| **Both** | RDB for fast boot + AOF for durability | Best of both worlds; slight overhead |

For a counter, AOF with `appendfsync everysec` is usually sufficient: at most 1 second of data lost on a crash.

For **zero** data loss, use Redis replication:
- Primary handles writes.
- Replica follows in real-time.
- If primary dies, promote replica.

---

## Constraint 4: "I Must Scale Beyond One Redis Node"

### Why It Sounds Impossible
A single Redis node is limited to one machine's RAM and one CPU core.

### The Solution: Redis Cluster
Redis Cluster shards data across multiple nodes using hash slots:

```
Key "counter:123" → hash slot 9283 → Node B
Key "counter:456" → hash slot 14502 → Node C
```

Each counter lives on exactly one node, so atomic operations remain atomic. You scale horizontally by adding nodes and redistributing hash slots.

**Caveat:** Multi-key operations (e.g., Lua scripts touching multiple keys) must target keys in the same hash slot. Use hash tags: `{user:123}:counter` and `{user:123}:limit` both map to the slot for `user:123`.

---

## The Meta-Pattern

Every "impossible" constraint in distributed counters is solved by the same realization:

> **Atomicity does not require locks. It requires a single agent of execution.**
>
> Whether that agent is one Redis thread, one Lua script, or one hash slot owner — the principle is identical: eliminate the gap.
