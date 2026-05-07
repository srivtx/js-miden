# M04 Counter Redis: The Principle

## The Principle

> **If two operations must happen together, they must be one operation.**

## Why This Matters

Distributed systems are full of gaps:
- The gap between read and write.
- The gap between check and act.
- The gap between validation and mutation.

In each gap, concurrency interleaves. Race conditions bloom. Data silently drifts from truth.

The counter is the simplest possible distributed system: one key, one number, two operations. If you cannot make this correct, you cannot make anything correct.

## The Hierarchy of Correctness

From weakest to strongest:

| Level | Technique | Guarantees | Cost |
|-------|-----------|------------|------|
| 0 | Nothing | None | Zero |
| 1 | Optimistic locking (`WATCH`) | No lost updates | Retry overhead |
| 2 | Transactions (`MULTI`/`EXEC`) | Batch atomicity | Still vulnerable to WATCH conflicts |
| 3 | Single atomic commands (`INCR`) | Perfect correctness | Limited to built-in operations |
| 4 | Lua scripts | Arbitrary logic, atomic | Slightly higher latency, single-node only |
| 5 | External consensus (Raft/Paxos) | Multi-key, multi-node | Complexity, latency |

For counters, Level 3 is usually enough. For conditional logic, Level 4. Level 5 is for distributed databases, not microservices.

## The One-Sentence Rule

Before writing any distributed state mutation, ask:

> "Can another request observe or modify this state between my read and my write?"

If yes, your code is wrong. Find the atomic primitive. Use it.

## The Deeper Pattern

This principle extends far beyond counters:

- **Rate limiting:** `GET` count then `SET` count → use Redis sorted sets with `ZADD` + `ZREMRANGEBYSCORE` in a Lua script.
- **Inventory:** `GET` stock then `DECR` → use `DECR` or Lua conditional.
- **Leader election:** `GET` lock then `SET` lock → use `SET key value NX PX 10000`.
- **Session storage:** `GET` session then `SET` session → use `HGETALL` + `HMSET` in a transaction.

Every distributed bug you have ever heard of — double-spend, lost update, dirty read, phantom read — is a violation of this principle.

## The Final Test

Show your counter code to a junior engineer. If they say "this looks fine," it is either perfect or dangerously subtle. The difference is whether the read and write are one command.

> Make it so simple that it cannot be wrong. Then make it simpler.
