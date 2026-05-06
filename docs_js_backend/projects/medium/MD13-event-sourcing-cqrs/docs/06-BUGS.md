# The Bugs

## Bug 1: Direct Read from Write Model

### How to Introduce It
Add a method that queries the event store directly for reads:

```typescript
export class OrderReadModel {
  // CORRECT: Query the read model
  async getById(id: string) {
    return prisma.orderReadModel.findUnique({ where: { aggregateId: id } });
  }

  // BUG: Direct read from write model (event store)
  async getByIdFromEventStore(id: string) {
    const events = await this.eventStore.getEvents(id);
    let state = { status: 'PENDING' };
    for (const event of events) {
      switch (event.eventType) {
        case 'OrderPlaced': state = { ...state, ...event.eventData, status: 'PENDING' }; break;
        case 'OrderCancelled': state = { ...state, status: 'CANCELLED' }; break;
      }
    }
    return { aggregateId: id, ...state, version: events.length };
  }
}
```

### Why It Exists
A developer added a "fallback" method for when the read model is stale. They thought: "If the projection hasn't run yet, let's just read from the event store." This defeats the entire purpose of CQRS.

### Symptoms You'll See
- Read queries are slow (must replay all events).
- Event store database is under read load, impacting write throughput.
- Read model indexes are unused. The database is not optimized for reads.
- Developers stop trusting the read model and use the "fallback" everywhere.

### How to Reproduce
```typescript
const readModel = new OrderReadModel();
const order = await readModel.getByIdFromEventStore('order-123');
// This reads from event_store table, not order_read_model
```

### The Fix
```typescript
// Remove getByIdFromEventStore entirely.
// If eventual consistency is unacceptable, use synchronous projections.
async getById(id: string) {
  const order = await prisma.orderReadModel.findUnique({ where: { aggregateId: id } });
  if (!order) {
    // Wait for projection with timeout, or return 202 Accepted
    throw new Error('Order not found. Projection may be pending.');
  }
  return order;
}
```

### Why the Fix Works
Forces all reads through the optimized read model. If consistency is needed, improve the projection mechanism (synchronous, or retry with timeout) instead of bypassing CQRS.

### Real-World Impact
In 2017, a UK fintech startup implemented CQRS but allowed customer support to query the event store directly for "complex queries." During a Black Friday sale, support queries saturated the event store, causing order placement commands to time out. The checkout was down for 45 minutes. Root cause: read load on the write database.

---

## Bug 2: Eventual Consistency Gap

### How to Introduce It
The projection runs asynchronously (`setImmediate`). The client receives a 201 Created with the aggregateId, then immediately GETs the order:

```typescript
// POST /orders
const result = await placeOrder.execute({ ... });
res.status(201).json({ orderId: result.aggregateId });

// Client immediately does:
// GET /orders/{result.aggregateId}
// BUG: Projection hasn't run yet. Returns 404.
```

### Why It Exists
Async projections are correct for scale, but the API contract doesn't account for the lag. The client assumes strong consistency.

### Symptoms You'll See
- Clients see 404 after successful creation.
- Frontend "create and redirect to detail page" flow breaks.
- Users think the order failed and submit again (duplicate orders).

### How to Reproduce
```typescript
const result = await placeOrder.execute({ ... });
const order = await readModel.getById(result.aggregateId);
console.log(order); // null
```

### The Fix
```typescript
// Option 1: Synchronous projection (simple, couples read/write)
await placeOrder.execute({ ... });
await projection.project(result.aggregateId); // Wait for projection
res.status(201).json({ orderId: result.aggregateId });

// Option 2: 202 Accepted with polling
res.status(202).json({ orderId: result.aggregateId, statusUrl: `/orders/${result.aggregateId}/status` });

// Option 3: Optimistic UI (return projected state)
const projectedState = await projection.project(result.aggregateId);
res.status(201).json({ orderId: result.aggregateId, ...projectedState });
```

### Why the Fix Works
Options 1-3 each trade off consistency vs. complexity. Option 1 is simplest for small scale. Option 2 is REST-idiomatic. Option 3 gives the best UX but requires the projection to be fast.

### Real-World Impact
In 2019, a major e-commerce platform using event sourcing returned 404s for 200ms after order creation. Their mobile app showed "Order failed" and allowed users to retry. During a flash sale, 15% of orders were duplicates. The company lost $2M in excess inventory and refunds. Fix: synchronous projection for the order detail view, async for everything else.
