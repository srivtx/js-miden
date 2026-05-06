# Architecture Decisions

## Decision: Event Store Implementation

### Option A: PostgreSQL (Relational)
**Pros:** ACID, familiar, transactional outbox pattern works naturally.
**Cons:** Not optimized for append-only logs, schema migrations are hard.

### Option B: EventStoreDB (Specialized)
**Pros:** Built for event sourcing, catch-up subscriptions, projections.
**Cons:** New infrastructure to operate, learning curve, another dependency.

### Option C: Kafka (Log)
**Pros:** Infinite retention, partitioning, replayable.
**Cons:** Not a database — no querying by aggregate ID without a consumer building an index.

### What We Chose: PostgreSQL
**Why:** We already use PostgreSQL for the read model. The event store is a simple append-only table. No new infrastructure required.

## Decision: Projection Strategy

### Option A: Synchronous Projection
**Pros:** Read model is immediately consistent. No eventual consistency bugs.
**Cons:** Write latency includes projection time. Write and read are coupled.

### Option B: Asynchronous Projection (In-Process)
**Pros:** Fast writes. Projection runs in background.
**Cons:** Read model lags by milliseconds. Crashes before projection = stale read model.

### Option C: Asynchronous Projection (Message Bus)
**Pros:** Decoupled, scalable, multiple consumers.
**Cons:** Infrastructure overhead (Kafka, RabbitMQ).

### What We Chose: Asynchronous In-Process (`setImmediate`)
**Why:** Simplicity for learning. In production, we'd use a message bus or outbox pattern.

## Decision: Snapshot Strategy

### Option A: No Snapshots
**Pros:** Simple, always replay from event 1.
**Cons:** Slow for aggregates with many events. 10K events = slow replay.

### Option B: Time-Based Snapshots (every N minutes)
**Pros:** Predictable snapshot cadence.
**Cons:** Might snapshot an unchanged aggregate. Wasted writes.

### Option C: Event-Count-Based Snapshots (every N events)
**Pros:** Snapshots exactly when replay cost grows.
**Cons:** Slightly more complex logic.

### What We Chose: Event-Count-Based (every 100 events)
**Why:** Replaying 100 events is fast. Replaying 10K is not. Snapshots at 100-event boundaries keep replay under 10ms.

## Decision: Read Model Schema

### Option A: One Table Per Aggregate (Normalized)
**Pros:** Clean schema, easy to query.
**Cons:** JOINs for related data. Schema changes require migrations.

### Option B: Document Store (JSONB in PostgreSQL)
**Pros:** Flexible schema, nested data.
**Cons:** No strong typing, harder to index.

### Option C: Materialized View
**Pros:** Automatic refresh, SQL queryable.
**Cons:** Refresh is expensive, not real-time.

### What We Chose: One Table Per Aggregate (with JSONB for items)
**Why:** The order read model is a flat table with typed columns for filtering (`status`, `customerId`) and JSONB for the items array. Balances queryability and flexibility.
