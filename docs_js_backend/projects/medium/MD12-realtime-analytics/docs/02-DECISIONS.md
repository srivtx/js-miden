# Architecture Decisions

## Decision: Storage Backend for Aggregates

### Option A: Redis (In-Memory)
**Pros:** O(1) counter operations, built-in TTL, data structures (sorted sets, hyperloglog).
**Cons:** Data loss on restart, bounded by RAM, no complex queries.

### Option B: PostgreSQL (Relational)
**Pros:** Persistent, ACID, SQL queries.
**Cons:** Write contention on counter rows, slow for high-frequency increments.

### Option C: Cassandra / ScyllaDB (Wide-Column)
**Pros:** Linear scalability, tunable consistency, time-series friendly.
**Cons:** Operational complexity, overkill for a single-node demo.

### What We Chose: Redis for Real-Time + PostgreSQL for Raw Events
**Why:** Redis handles high-frequency counter updates. PostgreSQL is the durable log. Dashboard queries read Redis; historical analysis reads PostgreSQL rollups.

## Decision: Windowing Strategy

### Option A: Tumbling Windows
**Pros:** Fixed, non-overlapping windows. Easy to reason about.
**Cons:** Events at window boundaries are split awkwardly. A spike at 00:59 and 01:01 appears in two windows.

### Option B: Sliding Windows
**Pros:** Smooths boundaries, captures trends across windows.
**Cons:** More computation, overlapping data stored multiple times.

### Option C: Session Windows
**Pros:** Dynamic size based on activity gaps. Great for user sessions.
**Cons:** Hard to pre-aggregate, complex eviction logic.

### What We Chose: Tumbling Windows (Primary) + Sliding Windows (Secondary)
**Why:** Tumbling windows are the default for per-minute/hour dashboards. Sliding windows are available for trend analysis.

## Decision: Aggregation Atomicity

### Option A: Read-Modify-Write (Application Side)
**Pros:** Flexible, can compute averages and derived stats.
**Cons:** Race conditions. Two simultaneous reads get the same value; one write is lost.

### Option B: Redis INCR / HINCRBY (Server Side)
**Pros:** Atomic, no race conditions.
**Cons:** Limited to simple counters. Can't compute averages in one operation.

### Option C: Lua Scripts (Server-Side Custom Logic)
**Pros:** Atomic complex logic.
**Cons:** Harder to debug, blocks Redis (single-threaded).

### What We Chose: Redis INCR for Counters, Lua for Complex Stats
**Why:** Counters are the 90% case. INCR is atomic and fast. For averages, we store sum and count separately, compute average on read.

## Decision: Event Ingestion Model

### Option A: Synchronous (Wait for DB + Redis)
**Pros:** Client knows event is stored.
**Cons:** Latency includes DB write + Redis write. Slow under load.

### Option B: Asynchronous (Queue + Worker)
**Pros:** Fast response to client. Workers process at their own pace.
**Cons:** Added infrastructure (queue, worker pool). Event not immediately queryable.

### Option C: Hybrid (Sync DB, Async Redis)
**Pros:** Durability guaranteed. Aggregation is best-effort fast.
**Cons:** Partial failure modes (DB written, Redis failed).

### What We Chose: Synchronous Ingestion
**Why:** Simplicity for a learning project. In production, we'd use an async queue (Bull, SQS) for Redis updates.
