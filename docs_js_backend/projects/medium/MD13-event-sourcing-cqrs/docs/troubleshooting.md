# Troubleshooting Guide

## Common Issues

### Direct Read from Write Model (BUG)

**Symptom**: Slow queries, high database load on event store

**Root Cause**: Querying event store instead of read model
```typescript
// BUG: Direct read from event store
async getByIdFromEventStore(id: string) {
  const events = await this.eventStore.getEvents(id);
  // Replay all events - slow!
  return this.replayEvents(events);
}
```

**Fix**: Always use read model
```typescript
// FIXED: Read from projection
async getById(id: string) {
  return prisma.orderReadModel.findUnique({
    where: { aggregateId: id },
  });
}
```

### Eventual Consistency Gap

**Symptom**: Order placed but not found in query

**Root Cause**: Projection hasn't run yet
```typescript
// After command execution
const result = await command.execute({...});

// BUG: Querying immediately
const order = await readModel.getById(result.aggregateId);
// order is null!
```

**Fix**: Handle eventual consistency
```typescript
// Option 1: Wait with timeout
async function waitForProjection(aggregateId: string, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const order = await readModel.getById(aggregateId);
    if (order) return order;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Projection timeout');
}

// Option 2: Return 202 Accepted
res.status(202).json({
  orderId: result.aggregateId,
  status: 'pending',
  pollUrl: `/orders/${result.aggregateId}`,
});
```

### Concurrency Conflicts

**Symptom**: "Version conflict" errors

**Root Cause**: Two commands modifying same aggregate simultaneously

**Fix**: Implement retry with exponential backoff
```typescript
async function executeWithRetry(command, input, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await command.execute(input);
    } catch (err) {
      if (err.message.includes('version')) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
        continue;
      }
      throw err;
    }
  }
}
```

### Event Store Growth

**Symptom**: Database size growing rapidly

**Causes**:
1. No snapshotting
2. High event volume
3. Large event payloads

**Fix**:
```typescript
// Create snapshots every N events
if (events.length % config.snapshotFrequency === 0) {
  await eventStore.createSnapshot(aggregateId, state, version);
}
```

### Projection Failures

**Symptom**: Read model out of sync with event store

**Debug**:
```sql
-- Check event count
SELECT aggregate_id, COUNT(*) 
FROM event_store 
GROUP BY aggregate_id;

-- Check read model version
SELECT aggregate_id, version 
FROM order_read_model;

-- Compare versions
```

**Fix**: Rebuild projection
```typescript
const projection = new OrderProjection();
await projection.rebuildAll();
```

## Performance Issues

### Slow Command Execution

**Diagnostic**:
1. Check event store write latency
2. Check business rule validation time
3. Check projection trigger time

**Solutions**:
- Add database indexes
- Optimize business rules
- Async projection updates

### Slow Queries

**Diagnostic**:
1. Check read model indexes
2. Check query complexity
3. Check cache hit rate

**Solutions**:
```sql
-- Add indexes
CREATE INDEX CONCURRENTLY idx_order_customer ON order_read_model(customer_id);
CREATE INDEX CONCURRENTLY idx_order_status ON order_read_model(status);
```

## Debugging Tools

### Event Store Inspection
```sql
-- Get all events for aggregate
SELECT * FROM event_store 
WHERE aggregate_id = '...' 
ORDER BY version ASC;

-- Get event count by type
SELECT event_type, COUNT(*) 
FROM event_store 
GROUP BY event_type;
```

### Read Model Inspection
```sql
-- Get order by aggregate ID
SELECT * FROM order_read_model 
WHERE aggregate_id = '...';

-- Check projection lag
SELECT 
  o.aggregate_id,
  e.max_version as event_version,
  o.version as read_version,
  (e.max_version - o.version) as lag
FROM order_read_model o
JOIN (
  SELECT aggregate_id, MAX(version) as max_version
  FROM event_store
  GROUP BY aggregate_id
) e ON o.aggregate_id = e.aggregate_id
WHERE e.max_version > o.version;
```

### Application Logs
```bash
# Enable debug logging
DEBUG=cqrs:* npm run dev

# Structured logging
LOG_FORMAT=json npm start
```

## Error Codes Reference

| Error | Cause | Solution |
|-------|-------|----------|
| INVALID_INPUT | Validation failed | Check input schema |
| ORDER_NOT_FOUND | Aggregate doesn't exist | Check aggregate ID |
| INVALID_STATE | Wrong status for action | Check order status |
| CONCURRENCY_ERROR | Version conflict | Retry with backoff |
| PROJECTION_TIMEOUT | Read model stale | Wait or rebuild |

## Getting Help

- Event Store Community: https://eventstore.com/blog/
- CQRS Discussion: https://groups.google.com/g/dddcqrs
- Stack Overflow: [cqrs] [event-sourcing] tags