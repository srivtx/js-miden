# Thinking Process: Food Delivery Architecture

## Initial Questions

**Q: Why not use a message queue for order processing?**
A: Phase 1 targets simplicity. A message queue (Redis/RabbitMQ) adds ops overhead. However, the order assignment race condition suggests we need at least atomic database operations.

**Q: Should driver assignment be push (broadcast) or pull (driver accepts)?**
A: Real platforms use both. Uber Eats uses push notification + batch optimization. Our Phase 1 uses pull (driver accepts) because it requires less infrastructure.

**Q: How do we calculate ETA accurately?**
A: The Haversine formula gives straight-line distance. Real platforms use road-network routing (OSRM, Google Maps). We accept the trade-off for Phase 1.

## Trade-off Analysis

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Atomic DB update** (updateMany with null check) | Simple, no extra infra | Doesn't handle high contention well | **Phase 1** |
| **Pessimistic locking** (SELECT FOR UPDATE) | Guaranteed consistency | Blocks concurrent reads, deadlock risk | Phase 2 |
| **Redis distributed lock** | Scalable across instances | Adds Redis dependency, lock expiration complexity | Phase 2 |
| **Queue-based assignment** | Sequential processing, audit trail | Latency increase, queue ops overhead | Phase 3 |

## Why Prisma + PostgreSQL?

- Type safety eliminates an entire class of query bugs
- Connection pooling handles peak-hour traffic
- Transaction support for atomic operations
- Migration management for schema evolution

## Why Socket.IO over SSE?

- Bidirectional communication needed for driver location updates
- Built-in reconnection and heartbeat handling
- Room-based broadcasting (per-order tracking rooms)

## Data Flow Sketch

```
Customer places order
    |
    v
Order created (PLACED)
    |
    v
Restaurant receives notification
    |
    v
Restaurant updates status -> PREPARING -> READY
    |
    v
Driver accepts order (ATOMIC CHECK)
    |
    v
Driver picks up -> PICKED_UP
    |
    v
Socket.IO broadcasts location updates
    |
    v
Customer sees live tracking + ETA
    |
    v
Driver delivers -> DELIVERED
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Race condition in driver assignment | High | High | Atomic updateMany + unique constraint |
| Inventory oversell | Medium | High | Inventory check in transaction |
| Database deadlock | Low | High | Short transactions, retry logic |
| Socket.IO memory leak | Medium | Medium | Room cleanup on disconnect |
