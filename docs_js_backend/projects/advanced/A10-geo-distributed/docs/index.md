# A10: Geo-Distributed API

## Overview

A geo-distributed API deployed across multiple regions with intelligent routing, data replication, and conflict resolution [1]. Designed to minimize latency by serving users from their nearest region while maintaining data consistency.

## What This Project Does

- **Multi-Region Deployment**: API runs in us-east, us-west, and eu-west
- **Smart Routing**: Routes users to the nearest/lowest-latency region
- **Data Replication**: Replicates writes across all regions
- **Conflict Resolution**: Handles concurrent updates using vector clocks

## Architecture

```
                    ┌─────────────┐
                    │   GeoDNS    │
                    │  (Route 53) │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  us-east   │  │  us-west   │  │  eu-west   │
    │  (3001)    │  │  (3002)    │  │  (3003)    │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ redis-east │  │ redis-west │  │ redis-eu   │
    └────────────┘  └────────────┘  └────────────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    ┌────────────┐
                    │ Conflict   │
                    │ Resolution │
                    └────────────┘
```

## Key Design Decisions

1. **Eventual Consistency**: Writes replicate asynchronously across regions.
2. **Vector Clocks**: Track causality to detect concurrent updates [2].
3. **Sticky Routing**: Users are pinned to a region for session consistency.
4. **Last-Write-Wins Fallback**: When conflicts can't be merged automatically.

## Services

| Service | Responsibility |
|---------|---------------|
| RoutingService | User-to-region mapping, latency-based routing |
| StorageService | Per-region data storage with vector clocks |
| ReplicationService | Cross-region data replication |
| ConflictResolutionService | Detect and resolve update conflicts |

## Known Issues

See [troubleshooting.md](troubleshooting.md) for the conflict resolution bug.

## References

[1] "Building Globally Distributed Applications," AWS Whitepaper, 2023.
[2] "Time, Clocks, and the Ordering of Events in a Distributed System," Leslie Lamport, 1978.
[3] "Dynamo: Amazon's Highly Available Key-Value Store," DeCandia et al., SOSP 2007.