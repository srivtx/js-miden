# A10 Evolution: v5 — Add Testing

## State of the System

The geo-distributed API is covered by Vitest. Tests verify storage, replication, conflict resolution, routing, and the intentional last-write-wins bug.

## What Changed

- **Unit tests for services.**
  - `storage.test.ts` — verifies `get`, `put`, `update`, `delete`, and vector-clock increment.
  - `replication.test.ts` — verifies `replicate`, `receiveReplication`, and peer management.
  - `conflict.test.ts` — verifies vector-clock comparison and conflict detection.
  - `routing.test.ts` — verifies sticky session routing and latency-based selection.
- **Integration tests for routes.**
  - `POST /api/data/:id` → returns record with incremented vector clock.
  - `GET /api/data/:id` → returns stored record or 404.
  - `POST /api/replicate` → accepts replication message and stores record.
  - `GET /api/conflicts` → returns detected conflicts.
  - `POST /api/conflict/resolve` → returns winner and strategy.
- **Bug reproduction tests.**
  - `lww.test.ts` — creates two concurrent updates and asserts that `last-write-wins` loses one update.
  - `loop.test.ts` — replicates a record and asserts that it is re-sent back to the source.
  - `dedup.test.ts` — receives the same replication message twice and asserts that the second write overwrites the first.

## What Still Breaks

- **Last-write-wins is documented but not fixed.** The test asserts the bug. A fix would merge object values.
- **Replication loop is documented but not fixed.** The test asserts the bug. A fix would add `excludeRegion`.
- **No deduplication.** The test asserts the bug. A fix would compare vector clocks before writing.
- **No multi-region integration tests.** Tests run against a single Express instance. There is no test that starts three instances and verifies cross-region replication.

## Code Snapshot (tests/conflict.test.ts)

```typescript
import { describe, it, expect } from 'vitest';
import { ConflictResolutionService } from '../src/services/ConflictResolutionService.js';

describe('conflict resolution', () => {
  const service = new ConflictResolutionService();

  it('detects concurrent updates', () => {
    const local = { id: '1', value: { balance: 100 }, vectorClock: { 'us-east': 1 }, timestamp: 1000, region: 'us-east', version: 1 };
    const remote = { id: '1', value: { balance: 200 }, vectorClock: { 'us-west': 1 }, timestamp: 2000, region: 'us-west', version: 1 };
    const result = service.resolveConflict(local, remote);
    expect(result.strategy).toBe('last-write-wins');
    expect(result.winner.value).toEqual({ balance: 200 }); // Bug: loses us-east update
  });

  it('resolves non-concurrent updates by vector clock', () => {
    const local = { id: '1', value: { balance: 100 }, vectorClock: { 'us-east': 2 }, timestamp: 1000, region: 'us-east', version: 2 };
    const remote = { id: '1', value: { balance: 200 }, vectorClock: { 'us-east': 1, 'us-west': 1 }, timestamp: 2000, region: 'us-west', version: 1 };
    const result = service.resolveConflict(local, remote);
    expect(result.strategy).toBe('vector-clock');
    expect(result.winner).toBe(local); // local is strictly newer
  });
});
```

## Architectural Notes

This is the "routing" stage. The test suite documents the three critical bugs that prevent safe multi-region operation: last-write-wins (data loss), replication loops (CPU exhaustion), and missing deduplication (version regression). These bugs are realistic production issues that caused outages at Riak (LWW data loss), Cassandra (repair storms), and MongoDB (oplog duplication).

## Migration Path to v6

1. Switch to ES modules (`"type": "module"` in package.json) and update imports.
2. Fix conflict resolution by merging object values instead of picking one winner.
3. Add `excludeRegion` to `ReplicationService.replicate()` to prevent loops.
4. Add deduplication by comparing vector clocks in `receiveReplication()`.
