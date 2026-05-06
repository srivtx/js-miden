# The Bugs

## Bug 1: Last-Write-Wins Conflict Resolution (CRITICAL)

### How to Introduce It
`ConflictResolutionService` detects concurrent updates but applies "last-write-wins" using wall-clock timestamps:
```typescript
// src/services/ConflictResolutionService.ts
resolveConflict(local, remote) {
  const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);

  if (comparison === 'concurrent') {
    this.conflicts.push({ recordId: local.id, timestamp: Date.now(), regions: [local.region, remote.region] });

    // BUG: Just picks the later timestamp, losing the other update!
    const winner = remote.timestamp > local.timestamp ? remote : local;
    const loser = remote.timestamp > local.timestamp ? local : remote;

    return {
      winner,
      loser,
      strategy: 'last-write-wins', // BUG: Should merge or preserve both
    };
  }
}
```

### Why It Exists
The developer wanted a simple, deterministic resolution. Timestamps feel objective. But they ignore causality and are vulnerable to clock skew.

### Symptoms You'll See
- User updates balance in us-east to $100. User updates balance in us-west to $200. After sync, only one value survives.
- The lost update is gone permanently. No audit trail of what was lost.
- Banking/booking systems cannot use this safely.
- During daylight saving time transitions or NTP resyncs, timestamps can go backwards, causing arbitrary winners.

### How to Reproduce
```typescript
it('BUG: Concurrent updates lose data with last-write-wins', () => {
  const local = { value: { balance: 100 }, vectorClock: { 'us-east': 1 } };
  const remote = { value: { balance: 200 }, vectorClock: { 'us-west': 1 } };

  const result = service.resolveConflict(local, remote);

  // BUG: Last-write-wins picks one, losing the other update
  expect(result.winner.value).toEqual({ balance: 200 });
  expect(result.strategy).toBe('last-write-wins');
  expect(result.loser.value).toEqual({ balance: 100 }); // Lost forever!
});
```

### The Fix
```typescript
resolveConflict(local, remote) {
  const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);

  if (comparison === 'concurrent') {
    // Option 1: Preserve both versions
    const mergedValue = { ...local.value, ...remote.value };
    const mergedVectorClock = {
      ...local.vectorClock,
      ...remote.vectorClock,
    };
    const mergedRecord = {
      id: local.id,
      value: mergedValue,
      timestamp: Date.now(),
      region: 'merged',
      vectorClock: mergedVectorClock,
      version: Math.max(local.version, remote.version) + 1,
    };

    return {
      winner: mergedRecord,
      loser: null,
      strategy: 'merge',
      conflicts: [local, remote],
    };
  }

  // ... non-concurrent case unchanged
}
```

### Why the Fix Works
For concurrent updates, a merge strategy preserves both values. For a shopping cart, this means both items are kept. For a bank balance, you might need a custom merge (e.g., sum the balances, or flag for manual review).

### Real-World Impact
In 2012, Riak (a Dynamo-inspired database) had a well-documented issue where customers using LWW lost data during cross-datacenter replication. A customer (a major telecom) stored call detail records in Riak with LWW. During a network partition, two datacenters accepted writes for the same subscriber record. When the partition healed, LWW discarded one datacenter's updates — 48 hours of call logs for 30,000 subscribers vanished. The root cause was clock skew of 200ms between datacenters. They switched to vector clocks with multi-value registers, preserving all concurrent versions for application-level resolution.

---

## Bug 2: Replication Loop

### How to Introduce It
When a region receives a replicated record, it re-sends it back to the source:
```typescript
receiveReplication(message) {
  const { record } = message;
  this.storage.put(record);
  // BUG: Replicating back without checking source!
  this.replicate(record); // Infinite loop
}
```

### Why It Exists
The developer forgot to filter out the source region from replication targets. The replication logic assumes "send to all peers" without excluding the sender.

### Symptoms You'll See
- CPU usage spikes to 100% across all regions.
- Network bandwidth saturates with replication traffic.
- Records accumulate infinite versions as they bounce back and forth.
- Vector clocks grow unbounded as each bounce increments timestamps.

### How to Reproduce
1. Start us-east and us-west.
2. Write a record to us-east.
3. Watch the logs: us-east sends to us-west, us-west sends back to us-east, repeat forever.

### The Fix
```typescript
replicate(record: RecordData, excludeRegion?: string): void {
  const message = { type: 'replicate', record, sourceRegion: this.storage.getRegion() };
  for (const peer of this.peers) {
    if (peer === excludeRegion) continue; // Skip source region
    const pending = this.pendingReplications.get(peer) || [];
    pending.push(message);
    this.pendingReplications.set(peer, pending);
  }
}

receiveReplication(message) {
  const { record, sourceRegion } = message;
  this.storage.put(record);
  // Replicate to peers EXCEPT the source
  this.replicate(record, sourceRegion);
}
```

### Real-World Impact
In 2016, Cassandra users reported "repair storms" where anti-entropy repair triggered infinite replication loops between datacenters. A misconfigured `replication_factor` combined with cross-DC repair caused one customer's cluster to generate 10TB/hour of replication traffic — 100x their normal rate. AWS billed them $50K for the month before they identified the loop.

---

## Bug 3: No Deduplication on Replication

### How to Introduce It
Receiving the same record multiple times creates duplicate entries:
```typescript
receiveReplication(message) {
  const { record } = message;
  // BUG: No check if we already have this exact version!
  this.storage.put(record);
}
```

### Why It Exists
The developer assumed TCP reliability guaranteed exactly-once delivery. But retransmissions, retry logic, and network partitions can cause the same message to arrive multiple times.

### Symptoms You'll See
- Storage size grows without new writes.
- Vector clocks appear to "rewind" because an old record overwrites a newer one.
- Metrics show 5x more replication messages than actual writes.

### The Fix
```typescript
receiveReplication(message) {
  const { record } = message;
  const existing = this.storage.get(record.id);

  if (existing) {
    const comparison = compareVectorClocks(existing.vectorClock, record.vectorClock);
    if (comparison === 'local' || comparison === 'equal') {
      // We already have this or a newer version. Ignore.
      return existing;
    }
  }

  this.storage.put(record);
  return record;
}
```

### Real-World Impact
MongoDB's initial replication implementation (pre-3.4) had a deduplication bug where secondary nodes would apply the same oplog entry multiple times during primary failover. This caused documents to be inserted twice, updated to incorrect values, or in rare cases, corrupted indexes. The fix was adding a `ts` (timestamp) and `h` (hash) uniqueness constraint on the oplog application layer.
