# M04: Deep Concepts

## Redis Commands: GET, SET, INCR

### GET and SET (Non-Atomic Pair)

```
┌─────────────┐              ┌─────────────┐
│   Client    │ ── GET ──▶   │    Redis    │
│             │ ◀── 5 ────   │  (value=5)  │
│             │              │             │
│  (computes  │              │             │
│   5+1=6)    │              │             │
│             │ ── SET 6 ─▶  │             │
│             │ ◀── OK ───   │  (value=6)  │
└─────────────┘              └─────────────┘
```

**Two network round-trips.** Between them, the value can change.

### INCR (Atomic Single Command)

```
┌─────────────┐              ┌─────────────┐
│   Client    │ ── INCR ──▶  │    Redis    │
│             │              │  (value=5)   │
│             │              │  atomically  │
│             │              │  becomes 6   │
│             │ ◀── 6 ─────  │  (value=6)   │
└─────────────┘              └─────────────┘
```

**One network round-trip.** No window for interleaving.

### The INCR Command Specification

```
INCR key

Time complexity: O(1)
Atomically increments the number stored at key by one.
If the key does not exist, it is set to 0 before performing the operation.
Returns the value of the key after the increment.
```

**Why `O(1)`?** Redis stores values as integers when possible. Incrementing an integer in memory is a single CPU instruction. No string parsing happens on the server side after the first store.

---

## Atomicity Explained with Examples

### Atomicity in Single-Threaded Redis

Redis uses one event loop thread:

```
Redis Event Loop:

┌─────────────────────────────────────────────────────┐
│  Queue: [INCR from A] [GET from B] [INCR from C]   │
│                                                      │
│  Worker Thread:                                      │
│    1. Dequeue INCR from A                            │
│    2. Read value (5)                                 │
│    3. Compute 5+1                                    │
│    4. Write value (6)                                │
│    5. Respond to A (6)                               │
│    ── Only now process next command ──               │
│    6. Dequeue GET from B                             │
│    7. Read value (6)                                 │
│    8. Respond to B (6)                               │
│    9. Dequeue INCR from C                            │
│   10. Read value (6)                                 │
│   11. Compute 6+1                                    │
│   12. Write value (7)                                │
│   13. Respond to C (7)                               │
└─────────────────────────────────────────────────────┘
```

No command ever sees a half-written value. The entire INCR executes before any other command starts.

### Why Read-Then-Write Fails (Detailed Timeline)

Consider two clients sending `POST /increment` simultaneously:

```
Client A          Network          Redis           Client B
   │                                 │                │
   │  GET counter                    │                │
   │───────────────────────────────▶│                │
   │                5                │                │
   │◀───────────────────────────────│                │
   │                                 │                │
   │  (computes 6)                   │   GET counter  │
   │                                 │◀───────────────│
   │                                 │       5        │
   │                                 │───────────────▶│
   │                                 │                │
   │                                 │  (computes 6)  │
   │                                 │                │
   │  SET counter 6                  │                │
   │───────────────────────────────▶│                │
   │                OK               │                │
   │◀───────────────────────────────│                │
   │                                 │                │
   │                                 │   SET counter 6│
   │                                 │◀───────────────│
   │                                 │      OK        │
   │                                 │───────────────▶│
   │                                 │                │
   │  Response: 6                    │                │
   │◀──── (but should be 7!) ───────│                │
   │                                 │  Response: 6   │
   │                                 │───────────────▶│
   │                                 │                │
```

**The lost update:** Both clients read `5`. Both write `6`. The counter only increased by 1, but two increments were requested.

### The Atomic Fix Timeline

```
Client A          Network          Redis           Client B
   │                                 │                │
   │  INCR counter                   │                │
   │───────────────────────────────▶│                │
   │                                 │                │
   │                                 │  INCR counter  │
   │                                 │◀───────────────│
   │                                 │                │
   │                                 │  (A's INCR     │
   │                                 │   completes    │
   │                                 │   first: 5→6)  │
   │                6                │                │
   │◀───────────────────────────────│                │
   │                                 │                │
   │                                 │  (B's INCR     │
   │                                 │   now runs:    │
   │                                 │   6→7)         │
   │                                 │       7        │
   │                                 │───────────────▶│
   │                                 │                │
```

**Result:** Counter went from 5 → 6 → 7. No lost increments.

---

## Race Conditions in Distributed Systems

### Definition

A **race condition** occurs when the correctness of a program depends on the relative timing of events (thread scheduling, network latency, process execution order).

In distributed systems, race conditions are inevitable because:
1. **Network latency is variable.** Request A might arrive first but Request B might reach Redis first.
2. **Clocks are not synchronized.** You cannot rely on timestamps across machines.
3. **Partial failures exist.** A request might succeed on the server but the response might be lost.

### The Counter Race Condition Is a "Lost Update"

In database theory, this specific race condition is called a **lost update anomaly**. It is one of the four classic concurrency anomalies (the others are dirty read, non-repeatable read, and phantom read).

**Isolation levels that prevent lost updates:**

| Isolation Level | Prevents Lost Updates? | Mechanism |
|-----------------|------------------------|-----------|
| Read Uncommitted | No | None |
| Read Committed | No | None |
| Repeatable Read | Yes | Row locking |
| Serializable | Yes | Full serialization |

Redis's single-threaded command processing effectively provides **serializable isolation** for individual commands.

---

## Distributed Systems and the Counter

### Why a Centralized Counter?

In a distributed system with multiple app servers, state must live in a central place:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Server A  │     │   Server B  │     │   Server C  │
│  (Node.js)  │     │  (Node.js)  │     │  (Node.js)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴──────┐
                    │    Redis    │
                    │  (Source    │
                    │   of Truth) │
                    └─────────────┘
```

Redis is the **source of truth.** Each server is stateless regarding the counter. This allows:
- **Horizontal scaling:** Add 10 more servers, counter still works.
- **Server restarts:** New server picks up the current count immediately.
- **No split-brain:** There is only one counter value, not one per server.

### The CAP Theorem Context

The CAP theorem states that a distributed system can guarantee at most two of:
- **C**onsistency
- **A**vailability
- **P**artition tolerance

Redis with AOF is **CP** ( Consistent and Partition-tolerant) within a single instance:
- **Consistent:** Every read gets the latest write (single thread).
- **Not Available during failover:** If the master fails, you must promote a replica or wait for recovery.

For a counter, this trade-off is usually acceptable. If you need higher availability, Redis Sentinel or Redis Cluster provides automatic failover at the cost of slightly more complex operations.
