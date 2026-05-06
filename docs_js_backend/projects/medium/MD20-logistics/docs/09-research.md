# Research Notes

## Logistics Industry Patterns

### Tracking Systems

**Event Sourcing**
- Every status change is an immutable event
- Complete audit trail
- Can replay history

**CQRS**
- Separate read and write models
- Optimized queries for tracking
- Eventual consistency acceptable

### Route Optimization

**Dijkstra's Algorithm**
- Find shortest path in graph
- Guaranteed optimal
- Slow for large graphs

**A* Algorithm**
- Heuristic-guided search
- Faster than Dijkstra
- Requires good heuristic

**Traveling Salesman Problem (TSP)**
- NP-hard optimization
- Approximation algorithms
- Real-world constraints

### Industry Examples

| Company | Tech Stack | Scale |
|---------|-----------|-------|
| FedEx | Java, Oracle | Millions of packages/day |
| UPS | COBOL, Java | 20M+ packages/day |
| DHL | SAP, Custom | Global network |
| Amazon Logistics | AWS, Custom | Same-day delivery |

## References

- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [A* Pathfinding](https://en.wikipedia.org/wiki/A*_search_algorithm)
