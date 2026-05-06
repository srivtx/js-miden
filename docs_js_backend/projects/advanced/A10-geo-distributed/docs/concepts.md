# Core Concepts

## Distributed Systems Fundamentals

### CAP Theorem

In a distributed data store, you can only guarantee two of three [1]:
- **Consistency**: All reads see the latest write
- **Availability**: Every request gets a response
- **Partition Tolerance**: System works despite network failures

This system chooses **AP** (Availability + Partition Tolerance) with eventual consistency.

### Vector Clocks

Vector clocks track causality in distributed systems [2]:

```
Process A: [A:1] → [A:2] → [A:3]
Process B: [B:1] → [B:2]

Concurrent: [A:2, B:1] and [A:1, B:2] are concurrent
           (neither happened-before the other)
```

Rules:
- VC1 ≤ VC2 if all VC1[i] ≤ VC2[i]
- VC1 < VC2 if VC1 ≤ VC2 and VC1 ≠ VC2
- VC1 || VC2 if neither VC1 ≤ VC2 nor VC2 ≤ VC1

## Replication Strategies

| Strategy | Consistency | Latency | Complexity |
|----------|-------------|---------|------------|
| Synchronous | Strong | High | Low |
| Asynchronous | Eventual | Low | Medium |
| Quorum | Configurable | Medium | High |

## Conflict Resolution Strategies

### Last-Write-Wins (LWW)
- Keep the update with the latest timestamp
- **Pros**: Simple, deterministic
- **Cons**: Clock skew causes data loss; concurrent updates lost

### Multi-Value Register
- Keep all concurrent values
- **Pros**: No data loss
- **Cons**: Client must resolve; storage grows

### CRDTs (Conflict-free Replicated Data Types)
- Data structures that merge automatically
- **Pros**: Always correct, no coordination
- **Cons**: Limited data types, implementation complexity

### Application-Level Merge
- Custom merge logic per data type
- **Pros**: Semantically correct
- **Cons**: Requires domain knowledge

## Geo-Routing

### DNS-Based Routing
- Route 53 latency records
- Geo-proximity routing
- Health check failover

### Application-Level Routing
- Measure RTT to each region
- Sticky sessions per user
- Dynamic region switching

## References

[1] Brewer, E. "CAP Twelve Years Later: How the 'Rules' Have Changed." IEEE Computer, 2012.
[2] Lamport, L. "Time, Clocks, and the Ordering of Events in a Distributed System." CACM, 1978.
[3] Shapiro, M., et al. "Conflict-free Replicated Data Types." SSS 2011.
[4] Vogels, W. "Eventually Consistent." ACM Queue, 2008.