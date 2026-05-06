# Old Ways vs New Ways (2025)

## Pattern: Database Change Detection

### The Old Way (2010-2015)
```sql
-- Polling with timestamp
SELECT * FROM users WHERE updated_at > '2024-01-01 00:00:00';
```
**Why we did it:** Simple, works everywhere.
**Why it's wrong now:** High database load, misses rapid sequential changes, can't detect DELETE.

### The New Way (2025)
```sql
-- Logical replication slot
SELECT * FROM pg_logical_slot_peek_changes('cdc_slot', NULL, NULL);
```
**Why it's better:** Near-real-time, low overhead, captures all operations including DELETE.

### Migration Path
1. Add a replication slot: `SELECT pg_create_logical_replication_slot('cdc_slot', 'pgoutput');`
2. Stream changes with `pg_recvlogical` or a library like `pg-logical-replication`.
3. Deprecate polling jobs.

---

## Pattern: Event Ordering

### The Old Way
Process events as they arrive, trusting the network.
**Why it's wrong:** Networks reorder packets. Consumer crashes cause replays.

### The New Way
Strict LSN ordering with backpressure.
**Why it's better:** Cache consistency. No phantom reads.

---

## Pattern: Consumer Offsets

### The Old Way
File-based offsets (`/var/lib/consumer.offset`).
**Why it's wrong:** File corruption, no replication, hard to scale horizontally.

### The New Way
Database-backed offsets with `UPSERT`.
**Why it's better:** Transactional, replicated, queryable.

---

## Pattern: Cache Invalidation

### The Old Way
```typescript
// Application-level cache invalidation
await db.updateUser(id, { name: 'New Name' });
await cache.del(`user:${id}`); // What if this fails?
```
**Why it's wrong:** Cache invalidation and DB update are not atomic. Network failure = stale cache.

### The New Way
```typescript
// CDC-driven cache invalidation
// Database change → CDC event → cache consumer → cache.set/del
```
**Why it's better:** Cache is always derived from the database. No manual invalidation.

---

## Pattern: Event Delivery Guarantees

### The Old Way
"Fire and forget" — publish event, hope it arrives.
**Why it's wrong:** Lost events during network partitions. No recovery mechanism.

### The New Way
At-least-once with idempotent consumers and persistent offsets.
**Why it's better:** Survives crashes, network issues, and consumer restarts.
