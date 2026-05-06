# A10 Evolution: v2 — Add TypeScript

## State of the System

The single-region API has been replicated across three regions (`us-east`, `us-west`, `eu-west`). Each instance runs the same code with different `REGION` and `REPLICAS` environment variables. Data structures are now typed, and vector clocks are introduced for causality tracking.

## What Changed

- **Explicit domain types.**
  - `RecordData` — `id`, `value`, `timestamp`, `region`, `vectorClock`, `version`.
  - `VectorClock` — `{ [region: string]: number }`.
  - `ReplicationMessage` — `type`, `record`, `sourceRegion`.
  - `RouteRequest` — `userId`, `region`, `latency`.
  - `ConflictResult` — `winner`, `loser`, `strategy`.
- **Service decomposition.**
  - `StorageService` — per-region in-memory storage with vector-clock increment on every `update()`.
  - `ReplicationService` — queues outbound replication messages per peer region.
  - `ConflictResolutionService` — compares vector clocks and detects concurrency.
  - `RoutingService` — sticky session routing and latency-based region selection.
- **Vector clock increment.** On every write, `StorageService.update()` increments `vectorClock[region]`. This replaces the naive timestamp-only approach of v1.

## What Still Breaks

- **No runtime validation of replication payloads.** A malicious POST to `/api/replicate` with a malformed `vectorClock` (e.g., `{"us-east": "abc"}`) bypasses TypeScript and crashes the comparison logic.
- **Last-write-wins on conflicts.** `ConflictResolutionService.resolveConflict()` detects concurrency correctly, but then picks the winner by `timestamp`. Clock skew causes data loss — the earlier update is discarded even if it was causally later.
- **Replication loop.** `ReplicationService.receiveReplication()` writes the record to storage and does not exclude the source region from further replication. The record bounces back and forth forever.
- **No deduplication.** The same replication message can be applied multiple times, overwriting newer local versions with older remote ones.
- **In-memory storage.** All data is lost on restart. There is no Cassandra, no DynamoDB, no Redis.

## Code Snapshot (services/ConflictResolutionService.ts)

```typescript
export class ConflictResolutionService {
  resolveConflict(local: RecordData, remote: RecordData): ConflictResult {
    const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);
    if (comparison === 'concurrent') {
      // BUG: detects conflict but resolves with last-write-wins
      const winner = remote.timestamp > local.timestamp ? remote : local;
      return { winner, loser: remote.timestamp > local.timestamp ? local : remote, strategy: 'last-write-wins' };
    }
    const winner = comparison === 'remote' ? remote : local;
    return { winner, loser: comparison === 'remote' ? local : remote, strategy: 'vector-clock' };
  }
}
```

## Architectural Notes

This is the "multi-region + replication" stage. The system now accepts writes locally and queues them for replication, achieving low latency (~2 ms local write) at the cost of eventual consistency. Vector clocks correctly identify when two regions have updated the same record concurrently. However, the conflict resolution strategy is broken: it detects the hard part (concurrency) but fails the easy part (merging) by falling back to timestamps.

## Migration Path to v3

1. Add Zod schemas for `RecordData`, `ReplicationMessage`, and `UpdateRequest`.
2. Fix conflict resolution by merging object values instead of picking one winner.
3. Add `excludeRegion` to `ReplicationService.replicate()` to prevent loops.
