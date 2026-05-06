# Research Notes

## Food Delivery Industry Patterns

### Order Lifecycle Management

Food delivery platforms typically manage orders through a state machine:

1. **PLACED** - Order received, payment confirmed
2. **CONFIRMED** - Restaurant acknowledges
3. **PREPARING** - Food being prepared
4. **READY** - Food ready for pickup
5. **PICKED_UP** - Driver collected order
6. **IN_TRANSIT** - Delivery in progress
7. **DELIVERED** - Order completed

Our implementation simplifies this to 5 states for Phase 1.

### ETA Calculation Methods

**Haversine Formula** (Current Implementation)
- Great-circle distance calculation
- Assumes straight-line distance
- Fast but not accurate for road networks

**Route-based Calculation** (Future Improvement)
- Integration with mapping APIs (Google Maps, Mapbox)
- Actual road distance and traffic data
- More accurate but requires API calls

**Machine Learning Models** (Advanced)
- Historical delivery time data
- Time of day, weather, traffic patterns
- Predictive ETA with confidence intervals

### Race Condition Prevention

Common patterns in ride-sharing and food delivery:

1. **Optimistic Locking** - Version numbers on records
2. **Pessimistic Locking** - Database row locks
3. **Atomic Operations** - Single-statement updates
4. **Distributed Locks** - Redis/ETCD for microservices
5. **Queue-based** - Message queues for sequential processing

### Inventory Management Patterns

**Inventory Reservation**
- Reserve items during checkout
- Expire reservation after timeout
- Release on cancellation

**Eventual Consistency**
- Async inventory updates
- Compensating transactions
- Saga pattern for distributed systems

### Real-time Tracking

**Polling** (Simple)
- Client polls every 5-10 seconds
- Easy to implement
- Higher server load

**WebSockets** (Current)
- Bidirectional communication
- Lower latency
- More complex infrastructure

**Server-Sent Events** (Alternative)
- One-way server to client
- Simpler than WebSockets
- Good for location updates

### Industry Examples

| Platform | Tech Stack | Notable Features |
|----------|-----------|------------------|
| Uber Eats | Go, Python, Java | ML-driven ETA |
| DoorDash | Python, Kotlin | Dasher assignment algorithm |
| Grubhub | Java, Python | Restaurant network |
| Deliveroo | Go, Ruby | Frank algorithm (dispatch) |

## References

- [Uber Engineering Blog](https://eng.uber.com/)
- [DoorDash Engineering](https://doordash.engineering/)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/best-practices)
- [Express 5 Migration](https://expressjs.com/en/guide/migrating-5.html)
