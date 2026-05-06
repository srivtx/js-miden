# Thinking Process: Ride Sharing Architecture

## Initial Questions

**Q: Why is surge pricing non-atomic a problem?**
A: Two separate queries (demand count, supply count) create a read skew. If a driver goes offline between demand read and supply read, the ratio is wrong.

**Q: How do real platforms handle dispatch?**
A: Uber uses batch optimization (collect requests for 2-5 seconds, solve assignment problem). Lyft uses greedy nearest-neighbor with ETA prediction.

**Q: Should we use a queue for ride requests?**
A: Phase 1 uses direct database writes. A queue adds latency but enables better batching and retry logic.

## Trade-off Analysis

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **DB transaction** (demand+supply in tx) | Simple, consistent | Slightly slower | **Phase 1** |
| **Redis counters** (INCR/DECR) | Very fast | Counter drift possible | Phase 2 |
| **Materialized view** | Fast reads | Stale data (refresh interval) | Phase 2 |
| **Event stream** (Kafka) | Real-time, audit trail | Heavy infrastructure | Phase 3 |

## Why Timestamp Validation for Locations?

Mobile networks can deliver location updates out of order. A driver might:
1. Send update A at t=0 (lat=40.1, lng=-73.1)
2. Send update B at t=5 (lat=40.2, lng=-73.2)
3. Network delays B; A arrives second

Without timestamp validation, the database overwrites the newer location with the older one.

## Data Flow Sketch

```
Rider requests ride
    |
    v
Calculate fare (distance + surge)
    |
    v
Create ride (REQUESTED)
    |
    v
Broadcast to nearby drivers
    |
    v
Driver accepts (ATOMIC CHECK)
    |
    v
Ride status -> ACCEPTED -> IN_PROGRESS
    |
    v
Socket.IO broadcasts driver location
    |
    v
Rider sees ETA + live location
    |
    v
Driver completes ride
    |
    v
Both parties rate each other
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Non-atomic surge pricing | High | High | Database transaction |
| Stale location updates | Medium | Medium | Timestamp validation |
| Double ride acceptance | Medium | High | Atomic update |
| Fare calculation disputes | Medium | Medium | Immutable fare record |
| Rating spam | Low | Low | Unique constraint (rideId) |
