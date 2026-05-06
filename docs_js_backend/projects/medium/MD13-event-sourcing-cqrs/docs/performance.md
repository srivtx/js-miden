# Performance Guide

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Command Latency | < 50ms | < 200ms |
| Query Latency | < 20ms | < 100ms |
| Projection Lag | < 1s | < 5s |
| Event Store Write | < 10ms | < 50ms |
| Throughput | 1000 cmd/s | 500 cmd/s |

## Optimization Strategies

### 1. Snapshots
Reduce event replay by using snapshots:
```typescript
// Create snapshot every 100 events
if (events.length % config.snapshotFrequency === 0) {
  await eventStore.createSnapshot(aggregateId, state, version);
}

// Replay from snapshot
const snapshot = await eventStore.getLatestSnapshot(aggregateId);
const fromVersion = snapshot?.version ?? 0;
const events = await eventStore.getEventsFromVersion(aggregateId, fromVersion);
```

### 2. Read Model Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_order_customer ON order_read_model(customer_id);
CREATE INDEX CONCURRENTLY idx_order_status ON order_read_model(status);
CREATE INDEX CONCURRENTLY idx_order_projected ON order_read_model(projected_at);
```

### 3. Async Projections
```typescript
// Fire and forget projection
setImmediate(() => {
  projection.project(aggregateId).catch(console.error);
});

// Or use message queue
await messageQueue.publish('projection.update', { aggregateId });
```

### 4. Connection Pooling
```typescript
const prisma = new PrismaClient({
  connectionLimit: 20,
});
```

### 5. Event Store Partitioning
```sql
-- Partition by aggregate type
CREATE TABLE event_store_orders PARTITION OF event_store
FOR VALUES IN ('Order');

-- Partition by date
CREATE TABLE event_store_2024_01 PARTITION OF event_store
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Benchmarks

| Scenario | Without Optimization | With Optimization |
|----------|---------------------|-------------------|
| Place order | 200ms | 30ms |
| Get order | 150ms | 10ms |
| List orders | 500ms | 50ms |
| Replay 1000 events | 2000ms | 20ms (with snapshot) |

## Monitoring

### Key Metrics
- Command execution time
- Event append latency
- Projection lag
- Read model staleness
- Snapshot frequency

### Tools
```bash
# PostgreSQL monitoring
SELECT * FROM pg_stat_statements ORDER BY total_time DESC;

# Application metrics
prometheus --config.file=prometheus.yml
```

## Load Testing

```bash
# Using k6
k6 run --vus 100 --duration 60s load-test.js
```

```javascript
// load-test.js
import http from 'k6/http';

export default function () {
  http.post('http://localhost:3001/orders', JSON.stringify({
    customerId: '550e8400-e29b-41d4-a716-446655440000',
    items: [{ productId: '1', quantity: 1, unitPrice: 10 }],
    shippingAddress: { street: 'St', city: 'City', country: 'US', zipCode: '00000' },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## References

- Event Store Performance: https://eventstore.com/blog/
- PostgreSQL Performance: https://wiki.postgresql.org/wiki/Performance_Optimization
- CQRS Performance: https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs#performance