# Old Ways vs New Ways (2015 vs 2025)

## Pattern: State Persistence

### The Old Way (2010-2015)
```sql
-- CRUD in a single table
UPDATE orders SET status = 'CANCELLED', cancelled_reason = 'Changed mind'
WHERE id = 'order-123';
-- The old status ('PENDING') is lost forever.
```
**Why we did it:** Simple, familiar, ORMs made it trivial.
**Why it's wrong now:** No audit trail. No way to know who cancelled or why. Bugs overwrite data permanently.

### The New Way (2025)
```typescript
// Event sourcing: append-only
await eventStore.append({
  aggregateId: 'order-123',
  eventType: 'OrderCancelled',
  eventData: { reason: 'Changed mind', cancelledBy: 'user-456' },
  version: 3,
});
// The full history is preserved. Replay to get current state.
```
**Why it's better:** Immutable history. Full auditability. Replay capability.

### Migration Path
1. Add an `event_store` table alongside existing CRUD tables.
2. Write events on every mutation (dual-write).
3. Build projections from events.
4. Decommission direct CRUD reads in favor of projections.

---

## Pattern: Read/Write Model Separation

### The Old Way
```sql
-- One database serves both reads and writes
SELECT * FROM orders WHERE customer_id = 'cust-1' ORDER BY created_at DESC;
-- Same table is locked during UPDATE
```
**Why it's wrong:** Read queries scan indexes and lock rows, slowing writes. Complex reports require 10-way JOINs.

### The New Way
```typescript
// Write model: event store (normalized, transactional)
await eventStore.append(event);

// Read model: denormalized, optimized for queries
await prisma.orderReadModel.findMany({
  where: { customerId: 'cust-1' },
  orderBy: { projectedAt: 'desc' },
});
```
**Why it's better:** Reads are fast (no JOINs). Writes are fast (single INSERT). Each scales independently.

---

## Pattern: Consistency Model

### The Old Way
```typescript
// Strong consistency everywhere
const order = await db.orders.create({ ... });
return order; // Client sees immediate result
```
**Why it's wrong:** Forces all replicas to synchronize. Limits throughput and geographic distribution.

### The New Way
```typescript
// Eventual consistency between write and read models
const result = await placeOrder.execute({ ... }); // Returns aggregateId
// Read model may lag by 100ms
setTimeout(async () => {
  const order = await readModel.getById(result.aggregateId);
}, 100);
```
**Why it's better:** Write path is uncoupled from read path. Acceptable for most use cases (users don't notice 100ms).

---

## Pattern: Audit Logging

### The Old Way
```sql
-- Separate audit table, manually maintained
INSERT INTO audit_log (table_name, row_id, action, changed_by, changed_at)
VALUES ('orders', 'order-123', 'UPDATE', 'user-456', NOW());
-- Often forgotten, sometimes disabled "for performance".
```
**Why it's wrong:** Audit is an afterthought. Can be bypassed. Schema drifts from main table.

### The New Way
```typescript
// Events ARE the audit log
{
  eventType: 'OrderCancelled',
  eventData: { reason: 'Changed mind', cancelledBy: 'user-456' },
  metadata: { correlationId: 'req-789', causationId: 'cmd-321' },
  createdAt: '2024-01-15T10:30:00Z'
}
```
**Why it's better:** Audit is inherent. Can't be disabled without disabling the entire system. Structured and queryable.

---

## Pattern: Schema Evolution

### The Old Way
```sql
-- Add column, backfill, hope nothing breaks
ALTER TABLE orders ADD COLUMN gift_message TEXT;
-- Old code doesn't know about gift_message. New code crashes on NULL.
```
**Why it's wrong:** Breaking changes require coordinated deploys. Rollbacks are risky.

### The New Way
```typescript
// Event upcasting
function upcastOrderPlacedEvent(eventData, sourceVersion) {
  if (sourceVersion === 1) {
    return { ...eventData, giftMessage: null }; // Default for old events
  }
  return eventData;
}
```
**Why it's better:** Old events are transformed on read. No migrations. No downtime.
