# Step-by-Step Build Guide

## Step 1: Regional API Setup

```typescript
// Each region runs the same code with different env vars
const REGION = process.env.REGION || 'us-east'; // us-east | us-west | eu-west
const PEERS = (process.env.PEERS || '').split(','); // ['us-west', 'eu-west']

const app = express();
const storage = new StorageService(REGION);
const replication = new ReplicationService(storage);
const conflict = new ConflictResolutionService();

PEERS.forEach(peer => replication.addPeer(peer));

app.listen(process.env.PORT || 3000, () => {
  console.log(`${REGION} API running on port ${process.env.PORT}`);
});
```

### Common Mistakes
- **Mistake**: Hardcoding region names in source code.
- **Why it breaks**: Can't deploy the same Docker image to all regions.
- **How to avoid**: Use environment variables for region identity and peer list.

---

## Step 2: Storage with Vector Clocks

```typescript
export class StorageService {
  private store: Map<string, RecordData> = new Map();

  update(id: string, value: unknown): RecordData {
    const existing = this.store.get(id);
    const vectorClock = existing
      ? { ...existing.vectorClock, [this.region]: (existing.vectorClock[this.region] || 0) + 1 }
      : { [this.region]: 1 };

    const record: RecordData = {
      id,
      value,
      timestamp: Date.now(),
      region: this.region,
      vectorClock,
      version: existing ? existing.version + 1 : 1,
    };

    this.store.set(id, record);
    return record;
  }
}
```

### Common Mistakes
- **Mistake**: Not incrementing the vector clock on update.
- **Why it breaks**: Two updates in the same region appear identical. Conflicts are not detected.
- **How to avoid**: Always increment `vectorClock[region]` before writing.

---

## Step 3: Asynchronous Replication

```typescript
export class ReplicationService {
  replicate(record: RecordData): void {
    const message = { type: 'replicate', record, sourceRegion: this.storage.getRegion() };
    for (const peer of this.peers) {
      const pending = this.pendingReplications.get(peer) || [];
      pending.push(message);
      this.pendingReplications.set(peer, pending);
    }
  }

  receiveReplication(message: ReplicationMessage): RecordData | null {
    const { record, sourceRegion } = message;
    const existing = this.storage.get(record.id);

    if (!existing) {
      this.storage.put(record);
      return record;
    }

    // Use ConflictResolutionService instead of simple timestamp comparison
    const result = this.conflictService.resolveConflict(existing, record);
    this.storage.put(result.winner);
    return result.winner;
  }
}
```

### Common Mistakes
- **Mistake**: Replicating back to the source region.
- **Why it breaks**: Infinite replication loops. Record bounces between regions forever.
- **How to avoid**: Skip replication if `targetRegion === sourceRegion`. Add a `replicatedFrom` field to deduplicate.

---

## Step 4: Conflict Resolution

```typescript
export class ConflictResolutionService {
  resolveConflict(local: RecordData, remote: RecordData): ConflictResult {
    const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);

    if (comparison === 'concurrent') {
      this.conflicts.push({ recordId: local.id, timestamp: Date.now(), regions: [local.region, remote.region] });

      // BETTER: Merge instead of LWW
      const mergedValue = this.mergeValues(local.value, remote.value);
      const mergedVectorClock = this.mergeVectorClocks(local.vectorClock, remote.vectorClock);
      const mergedRecord: RecordData = {
        id: local.id,
        value: mergedValue,
        timestamp: Date.now(),
        region: 'merged',
        vectorClock: mergedVectorClock,
        version: Math.max(local.version, remote.version) + 1,
      };

      return { winner: mergedRecord, loser: null, strategy: 'merge' };
    }

    const winner = comparison === 'remote' ? remote : local;
    const loser = comparison === 'remote' ? local : remote;
    return { winner, loser, strategy: 'vector-clock' };
  }

  private mergeValues(a: unknown, b: unknown): unknown {
    // Application-specific merge: for objects, recursively merge keys
    if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
      return { ...a, ...b };
    }
    // For other types, fallback to array of both values
    return [a, b];
  }
}
```

### Common Mistakes
- **Mistake**: Using last-write-wins for all data types.
- **Why it breaks**: LWW loses updates. A shopping cart merge should preserve all items, not just the latest.
- **How to avoid**: Implement application-specific merge functions. Use CRDTs where applicable.

---

## Step 5: Routing Service

```typescript
export class RoutingService {
  private routes: Map<string, string> = new Map();
  private regionLatencies: Map<string, number[]> = new Map();

  routeUser(userId: string, clientRegion?: string): string {
    if (this.routes.has(userId)) {
      return this.routes.get(userId)!; // Sticky session
    }
    const region = clientRegion || this.getLowestLatencyRegion();
    this.routes.set(userId, region);
    return region;
  }

  private getLowestLatencyRegion(): string {
    let best = 'us-east';
    let bestLatency = Infinity;
    for (const [region, latencies] of this.regionLatencies) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      if (avg < bestLatency) { bestLatency = avg; best = region; }
    }
    return best;
  }
}
```

### Common Mistakes
- **Mistake**: Not using sticky sessions.
- **Why it breaks**: A user writes to us-east, then reads from eu-west before replication completes. They see stale data and think their write failed.
- **How to avoid**: Pin users to a region for the duration of their session.

---

## Step 6: Testing Cross-Region Replication

```bash
# Write to us-east
curl -X POST http://localhost:3001/api/data/user-123 \
  -H "Content-Type: application/json" \
  -d '{"value": {"name": "Alice", "balance": 100}}'

# Read from us-west (may be stale initially)
curl http://localhost:3002/api/data/user-123

# Read from eu-west
curl http://localhost:3003/api/data/user-123
```

---

## Step 7: Simulating a Conflict

```bash
# Terminal 1: Update in us-east
curl -X POST http://localhost:3001/api/data/user-123 \
  -d '{"value": {"balance": 100}}'

# Terminal 2: Update in us-west (before replication)
curl -X POST http://localhost:3002/api/data/user-123 \
  -d '{"value": {"balance": 200}}'

# Check conflicts
curl http://localhost:3001/api/conflicts
```
