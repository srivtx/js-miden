# Troubleshooting

## Known Bugs

### Bug 1: No Conflict Resolution (CRITICAL)

**Symptom**: User updates balance in us-east to $100, us-west to $200. After sync, only one value survives. The other update is lost permanently.

**Root Cause**: `ConflictResolutionService` detects concurrent updates but applies "last-write-wins" instead of merging or preserving both versions.

**Location**: `src/services/ConflictResolutionService.ts`

**Buggy Code**:
```typescript
resolveConflict(local, remote) {
  const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);

  if (comparison === 'concurrent') {
    this.conflicts.push({ recordId: local.id, ... });

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

**Impact**:
- Data loss on concurrent writes
- Banking/booking systems cannot use this safely
- Violates the expectation that both updates should be preserved

**Fix**: Implement proper merge strategies:
```typescript
// Option 1: Preserve both versions
return {
  winner: mergedRecord,
  loser: null,
  strategy: 'merge',
  conflicts: [local, remote]
};

// Option 2: Application-specific merge
const mergedValue = mergeValues(local.value, remote.value);
```

**Test**: `tests/conflict.test.ts` - "BUG: Concurrent updates lose data"

## Common Issues

### Stale Reads
- Symptom: Client reads old data after writing
- Cause: Replication lag between regions
- Mitigation: Read-after-write consistency for critical operations

### Split Brain
- Symptom: Regions diverge and can't reconcile
- Cause: Network partition + writes on both sides
- Mitigation: Implement CRDTs or Paxos/Raft consensus

## Debug Logging

```bash
DEBUG=geo:* npm run dev
```

## References

[1] "Conflict Resolution for Eventual Consistency," Shapiro et al., 2016.
[2] "Dynamo: Amazon's Highly Available Key-Value Store," SOSP 2007.