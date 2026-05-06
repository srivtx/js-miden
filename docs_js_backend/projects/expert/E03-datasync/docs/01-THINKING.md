# E03 Data Sync: Design Thinking

## Constraints & Forces

### 1. Availability vs Consistency
The CAP theorem says you can't have both during a partition. CRDTs choose availability: every peer can always write, and when the partition heals, consistency is restored automatically.

**Resolution**: Accept that concurrent edits may produce non-intuitive merges (e.g., both "Hello" and "World" coexist). Optimize for "no data loss" over "intuitive result."

### 2. Bandwidth vs Sync Frequency
Sending full state on every reconnect wastes bandwidth. Sending only deltas requires tracking what's changed.

**Resolution**: Hybrid approach. First sync sends full state + vector clock. Subsequent syncs send only operations with vector clocks greater than the peer's known clock.

### 3. Memory vs Correctness
Storing tombstones forever prevents resurrection but grows memory unboundedly. Deleting old tombstones risks resurrection if a very stale peer reconnects.

**Resolution**: Tombstone garbage collection. After all known peers have acknowledged a deletion beyond a certain clock threshold, the tombstone can be removed.

## Mental Models

### The Vector Clock as Causality Tracker
```
Peer A: {A: 3, B: 2, C: 1}
Peer B: {A: 3, B: 2, C: 1}
  → States are causally consistent. B has seen everything A has.

Peer A: {A: 3, B: 2, C: 1}
Peer B: {A: 3, B: 2, C: 2}
  → B is ahead of A on C. A needs C's event 2.

Peer A: {A: 3, B: 2, C: 1}
Peer B: {A: 3, B: 1, C: 2}
  → Concurrent! A has B:2 which B doesn't have. B has C:2 which A doesn't have.
  → Neither is "ahead." Both updates are valid and must be merged.
```

### The Tombstone as a Deletion Receipt
When a document is deleted, we don't just erase it. We create a tombstone:
```typescript
{
  documentId: 'doc-1',
  deletedAt: 1699999999999,
  vectorClock: { A: 2 }
}
```

This tombstone is sent to all peers. When a peer receives it, they delete their local copy. If a stale peer later sends an old version of `doc-1`, the tombstone's vector clock proves the deletion happened after the stale update, so the deletion wins.

### CRDTs as Mathematical Objects
A CRDT is not an algorithm. It is a data structure with mathematical properties:
1. **Commutativity**: `merge(A, B) == merge(B, A)`
2. **Associativity**: `merge(merge(A, B), C) == merge(A, merge(B, C))`
3. **Idempotence**: `merge(A, A) == A`

These properties guarantee that no matter the order of syncs, all peers converge to the same state.

## Risk Scenarios

1. **Missing tombstones**: Alice deletes a document. Bob never receives the tombstone. Bob's next sync resurrects the document. Alice is confused: "I deleted this!"
2. **Wrong conflict resolution**: Two peers concurrently edit the same register. LWW keeps only the later timestamp. If clocks are skewed, the "wrong" edit wins.
3. **Vector clock overflow**: In a long-running system, vector clocks grow with every new peer. After 10,000 peers, the clock is a 10,000-key object.
4. **No causal delivery**: A peer receives update B before update A, even though B depends on A. The CRDT must handle out-of-order delivery.

## Trade-Off Analysis

| Approach | Pros | Cons |
|----------|------|------|
| State-based CRDTs | Simple, self-contained | Large payloads, full state sent |
| Operation-based CRDTs | Small deltas, efficient | Requires causal broadcast delivery |
| Delta-state CRDTs | Best of both | Complex implementation |
| OT (Operational Transform) | Intuitive merges | Requires central server, complex transformation functions |
| Manual merge (Git-style) | Full user control | Users hate merge conflicts |
| Last-Write-Wins | Simple | Silent data loss |
