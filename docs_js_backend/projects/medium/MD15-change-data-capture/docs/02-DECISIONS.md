# Architecture Decisions

## Decision: CDC Mechanism

### Option A: Database Triggers
**Pros:** Simple, native to PostgreSQL, synchronous with transaction.
**Cons:** Slows down writes, hard to debug, doesn't capture DDL.

### Option B: WAL Reading (Logical Replication)
**Pros:** Post-commit only (no phantom events), captures all changes, low overhead.
**Cons:** Complex setup, requires `pg_logical` slot management.

### Option C: Polling (Timestamp-based)
**Pros:** Simple, works on any database.
**Cons:** Misses rapid changes, high database load, no DELETE detection without soft deletes.

### What We Chose: Simulated WAL Reading
**Why:** For educational purposes, we simulate WAL by writing events to a `cdc_events` table inside the same transaction. In production, you'd use `pg_recvlogical` or Debezium.

## Decision: Event Delivery Guarantee

### Option A: At-Most-Once
**Pros:** No duplicates, simple.
**Cons:** Can lose events on crash.

### Option B: At-Least-Once
**Pros:** No lost events.
**Cons:** Consumers must be idempotent.

### Option C: Exactly-Once
**Pros:** Perfect semantics.
**Cons:** Requires distributed transactions (2PC) or idempotent consumers with deduplication.

### What We Chose: At-Least-Once + Idempotent Consumers
**Why:** Exactly-once is extremely expensive. At-least-once with idempotency covers 99% of use cases (caching, search indexing).

## Decision: Consumer Offset Storage

### Option A: In-Memory
**Pros:** Fast, simple.
**Cons:** Lost on restart.

### Option B: PostgreSQL Table
**Pros:** Persistent, transactional.
**Cons:** Write overhead per event.

### Option C: Redis
**Pros:** Fast, TTL support.
**Cons:** Another dependency, not strongly consistent.

### What We Chose: PostgreSQL Table (`cdc_offsets`)
**Why:** Same database as source. Can wrap offset update in the consumer's transaction for atomicity.
