# Architecture

## System Architecture

The geo-distributed system consists of independent regional deployments that communicate via a replication layer.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Global Load Balancer                         │
│                    (GeoDNS / Latency-Based Routing)                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   US East     │    │   US West     │    │   EU West     │
│   Region      │    │   Region      │    │   Region      │
│               │    │               │    │               │
│ ┌───────────┐ │    │ ┌───────────┐ │    │ ┌───────────┐ │
│ │   API     │ │    │ │   API     │ │    │ │   API     │ │
│ │  Server   │ │    │ │  Server   │ │    │ │  Server   │ │
│ └─────┬─────┘ │    │ └─────┬─────┘ │    │ └─────┬─────┘ │
│       │       │    │       │       │    │       │       │
│ ┌─────▼─────┐ │    │ ┌─────▼─────┐ │    │ ┌─────▼─────┐ │
│ │   Local   │ │◄──►│ │   Local   │ │◄──►│ │   Local   │ │
│ │   Redis   │ │    │ │   Redis   │ │    │ │   Redis   │ │
│ └───────────┘ │    │ └───────────┘ │    │ └───────────┘ │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │   Replication    │
                    │     Service      │
                    └──────────────────┘
```

## Data Flow

### Write Flow
```
Client → us-east API
  → StorageService.update() (local write)
  → VectorClock incremented for us-east
  → ReplicationService.replicate() (queue for us-west, eu-west)
  → Return 200 OK to client
  → Async: Replicate to other regions
```

### Read Flow
```
Client → GeoDNS → nearest region
  → StorageService.get() (local read)
  → Return data immediately
  → Note: May be stale if replication lag exists
```

### Conflict Resolution Flow
```
us-east updates record-1: { balance: 100 }
us-west updates record-1: { balance: 200 } (concurrent)

Replication:
  us-east receives us-west's update
  → ConflictResolutionService.resolveConflict()
  → Vector clocks are concurrent → CONFLICT!
  → Strategy applied (BUG: last-write-wins loses data)
```

## Vector Clock Implementation

Each record maintains a vector clock mapping region → logical timestamp:

```json
{
  "id": "user-123",
  "value": { "balance": 100 },
  "vectorClock": { "us-east": 3, "us-west": 2, "eu-west": 1 }
}
```

Comparison rules:
- A > B if all regions in A ≥ B and at least one >
- A || B (concurrent) if both have regions the other doesn't have or both have greater values

## CAP Theorem Trade-offs

This system prioritizes:
- **Availability**: Every request gets a response (even if stale)
- **Partition Tolerance**: Works when regions can't communicate
- **Eventual Consistency**: Sacrifices strong consistency for availability

## References

[1] "CAP Twelve Years Later," Eric Brewer, IEEE Computer, 2012.
[2] "Conflict Resolution for Eventual Consistency," Marc Shapiro, 2016.
[3] "Dynamo: Amazon's Highly Available Key-Value Store," SOSP 2007.