# Thinking Process: Logistics Architecture

## Initial Questions

**Q: Why is status/tracking inconsistency a problem?**
A: If shipment status is updated but tracking event creation fails, the customer sees conflicting information. This destroys trust.

**Q: Why do greedy algorithms create circular routes?**
A: Greedy nearest-neighbor only looks at the next step, not the overall path. It might route through a warehouse that sends the package back toward its origin.

**Q: How do real logistics companies optimize routes?**
A: UPS uses ORION (On-Road Integrated Optimization and Navigation) with 1,000+ constraints. FedEx uses Dijkstra's algorithm with real-time traffic.

## Trade-off Analysis

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **DB transaction** (status + tracking) | Simple, consistent | Slightly slower | **Phase 1** |
| **Event sourcing** (append-only log) | Complete audit trail | Complex replay logic | Phase 2 |
| **Message queue** (async tracking) | Decoupled | Eventual consistency | Phase 3 |

## Route Optimization

| Algorithm | Time Complexity | Optimality | Use Case |
|-----------|----------------|------------|----------|
| Greedy nearest-neighbor | O(n^2) | Not optimal | Phase 1 (simple) |
| Dijkstra's | O(V^2) or O(E + V log V) | Optimal (shortest path) | Road networks |
| A* | O(E) | Optimal (with good heuristic) | Large graphs |
| TSP heuristics | O(n^2) to O(n^3) | Near-optimal | Multi-stop delivery |

## Data Flow Sketch

```
Shipment created
    |
    v
Tracking event: CREATED
    |
    v
Route calculated (origin -> destination)
    |
    v
Status: PICKED_UP -> IN_TRANSIT -> AT_WAREHOUSE -> OUT_FOR_DELIVERY -> DELIVERED
    |
    v
Each status change + tracking event (ATOMIC)
    |
    v
Inventory updated at each warehouse
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Status/tracking inconsistency | High | High | Database transaction |
| Circular routes | Medium | High | Direction check in algorithm |
| Tracking number collision | Low | High | Timestamp + random + prefix |
| Inventory mismatch | Medium | High | Transactional updates |
| Route inefficiency | High | Medium | A* or Dijkstra in Phase 2 |
