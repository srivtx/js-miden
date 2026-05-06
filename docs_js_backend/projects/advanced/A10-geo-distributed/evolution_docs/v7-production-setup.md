# A10 Evolution: v7 — Production Setup

## State of the System

The geo-distributed API is deployed as a multi-region, Cassandra-backed service with CRDT merge, GeoDNS routing, and mTLS replication.

## What Changed

- **Docker + multi-region compose.** `docker-compose.yml` runs three API instances (`us-east:3001`, `us-west:3002`, `eu-west:3003`) and a Cassandra cluster.
- **Cassandra storage.** `StorageService` uses the Cassandra driver with `LOCAL_QUORUM` for writes. Data is durable and replicated across datacenters.
- **CRDT merge.** `ConflictResolutionService` uses CRDT maps for JSON objects. Concurrent updates to different keys are merged automatically. Concurrent updates to the same key use LWW with vector-clock validation.
- **GeoDNS.** Route 53 latency-based routing directs users to the nearest region. Health checks fail over to healthy regions automatically.
- **mTLS replication.** Replication messages are signed with HMAC-SHA256 and transmitted over TLS. Regions authenticate each other via mutual TLS certificates.
- **Anti-entropy repair.** A background job (Merkle tree comparison) runs every hour to detect missing replication messages and repair gaps.
- **Read repair.** `GET /api/data/:id` triggers a background quorum read if the local version is older than a configured staleness threshold.
- **Prometheus metrics.** `replication_lag_seconds`, `conflicts_total`, `cross_region_requests_total`, `storage_reads_total`.
- **Kubernetes federation.** Each region runs its own Kubernetes cluster. Services are deployed with `topologySpreadConstraints` for zone awareness.

## What Still Breaks

- **No strong consistency option.** Bank transfers require CP semantics, but the system is AP everywhere. A separate CP service (CockroachDB) would handle financial transactions.
- **No Byzantine fault tolerance.** Regions are assumed honest. A compromised region could inject malicious replication messages.
- **No automated conflict resolution for complex types.** CRDTs handle maps and counters, but custom business logic (e.g., "balance must be non-negative") requires application-level merge functions.
- **No cross-region transactions.** Two-phase commit is not implemented. Multi-region transactions require saga patterns.

## Code Snapshot (docker-compose.yml)

```yaml
version: '3.8'
services:
  api-us-east:
    build: .
    ports:
      - "3001:3000"
    environment:
      - REGION=us-east
      - REPLICAS=us-west,eu-west
      - CASSANDRA_HOSTS=cassandra-east:9042
      - TLS_CERT=/certs/us-east.crt
      - TLS_KEY=/certs/us-east.key
  api-us-west:
    build: .
    ports:
      - "3002:3000"
    environment:
      - REGION=us-west
      - REPLICAS=us-east,eu-west
      - CASSANDRA_HOSTS=cassandra-west:9042
  api-eu-west:
    build: .
    ports:
      - "3003:3000"
    environment:
      - REGION=eu-west
      - REPLICAS=us-east,us-west
      - CASSANDRA_HOSTS=cassandra-eu:9042
  cassandra-east:
    image: cassandra:4.1
  cassandra-west:
    image: cassandra:4.1
  cassandra-eu:
    image: cassandra:4.1
```

## Architectural Notes

This is the "production" stage. The system now provides low-latency reads and writes globally, with automatic conflict detection and CRDT-based merge. Cassandra ensures durability. GeoDNS routes users efficiently. mTLS protects replication traffic. However, the system is uniformly AP; applications requiring strong consistency need a separate CP layer.

## Future Work

1. Add a CP service (CockroachDB or Spanner) for strong-consistency operations.
2. Implement Byzantine fault tolerance with signed replication messages and quorum validation.
3. Add cross-region saga patterns for distributed transactions.
4. Add automated conflict resolution UI for application-level merge decisions.
