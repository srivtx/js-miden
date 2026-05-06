# A10 Evolution: v4 — Add Logging

## State of the System

Every write, replication, and conflict resolution is logged as structured JSON. Logs include region IDs, vector clocks, conflict strategies, and replication queue depths. The system is now observable across regions.

## What Changed

- **Structured JSON logger.** `logInfo()` and `logError()` output single-line JSON with `level`, `message`, `timestamp`, and metadata.
- **Per-write logging.** `StorageService.update()` logs `id`, `region`, `vectorClock`, and `version` after every local write.
- **Replication logging.** `ReplicationService.replicate()` logs `recordId`, `sourceRegion`, and `peerCount`. `receiveReplication()` logs `recordId`, `sourceRegion`, and whether the record was new, updated, or ignored.
- **Conflict logging.** `ConflictResolutionService.resolveConflict()` logs `recordId`, `strategy` (`vector-clock` | `last-write-wins` | `merge`), and `comparison` (`local` | `remote` | `concurrent`).
- **Routing logging.** `RoutingService.routeUser()` logs `userId`, `assignedRegion`, and `latencyMs`.

## What Still Breaks

- **Replication loop is logged but not fixed.** Logs show the same `recordId` being replicated back and forth between regions with incrementing vector clocks. The loop is visible, but there is no mechanism to stop it.
- **Last-write-wins is logged but not fixed.** Conflict logs show `strategy: 'last-write-wins'` with `comparison: 'concurrent'`. The data loss is visible, but the merge strategy is not implemented.
- **No deduplication logging.** A record received twice is logged as `updated` both times, even though the second write is a no-op.
- **No cross-region trace ID.** A write in `us-east` generates a local log, but the replication to `eu-west` has no correlation ID. Debugging a conflict requires manually matching timestamps.

## Code Snapshot (services/ReplicationService.ts)

```typescript
replicate(record: RecordData): void {
  const message: ReplicationMessage = { type: 'replicate', record, sourceRegion: this.storage.getRegion() };
  for (const peer of this.peers) {
    const pending = this.pendingReplications.get(peer) || [];
    pending.push(message);
    this.pendingReplications.set(peer, pending);
  }
  logInfo('Replicating record', { recordId: record.id, peers: this.peers.size, sourceRegion: this.storage.getRegion() });
}

receiveReplication(message: ReplicationMessage): RecordData | null {
  const { record, sourceRegion } = message;
  const existing = this.storage.get(record.id);
  if (!existing) {
    this.storage.put(record);
    logInfo('Replication accepted (new)', { recordId: record.id, sourceRegion });
    return record;
  }
  if (record.timestamp > existing.timestamp) {
    this.storage.put(record);
    logInfo('Replication accepted (update)', { recordId: record.id, sourceRegion });
    return record;
  }
  logInfo('Replication ignored (stale)', { recordId: record.id, sourceRegion });
  return existing;
}
```

## Architectural Notes

This is the "routing + conflict resolution" stage. The system now produces a detailed log of every replication event and conflict. An operator can query `GET /api/conflicts` and see which records had concurrent updates. However, the conflict resolution strategy is still `last-write-wins`, so the operator can see that data was lost but cannot recover it.

## Migration Path to v5

1. Add Vitest tests for cross-region replication, conflict detection, and merge strategies.
2. Fix conflict resolution by merging object values instead of picking one winner.
3. Add `excludeRegion` to prevent replication loops.
4. Add deduplication by comparing vector clocks before writing.
