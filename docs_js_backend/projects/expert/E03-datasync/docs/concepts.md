# Core Concepts

## CRDTs (Conflict-free Replicated Data Types)

CRDTs are data structures that can be replicated across multiple nodes and merged without coordination [1]. They guarantee that all replicas converge to the same state.

### Types of CRDTs

| Type | Use Case | Example |
|------|----------|---------|
| G-Counter | Increment-only counters | Like counts |
| PN-Counter | Increment/decrement counters | Inventory |
| G-Set | Grow-only set | Tags |
| OR-Set | Add/remove set | Shopping cart |
| LWW-Register | Single value with timestamp | User profile |
| AW-Map | Key-value map | JSON document |

### CRDT Properties

1. **Associativity**: `(a ⊔ b) ⊔ c = a ⊔ (b ⊔ c)`
2. **Commutativity**: `a ⊔ b = b ⊔ a`
3. **Idempotency**: `a ⊔ a = a`

## Version Vectors

Version vectors track the happens-before relationship in distributed systems [2]:

```
Peer A edits doc-1: vectorClock = { A: 1 }
Peer B edits doc-1: vectorClock = { B: 1 }

These are concurrent! Neither happened-before the other.
Merge: vectorClock = { A: 1, B: 1 }
```

### vs Lamport Timestamps

| Feature | Lamport Timestamp | Version Vector |
|---------|-------------------|----------------|
| Partial Ordering | Yes | Yes |
| Concurrent Detection | No | Yes |
| Number of Peers | 1 clock | N clocks |
| Merge Complexity | Low | Medium |

## Sync Protocols

### State-Based Sync
- Send entire document state
- **Pros**: Simple, self-contained
- **Cons**: High bandwidth for large documents

### Op-Based Sync
- Send only operations (deltas)
- **Pros**: Low bandwidth, real-time feel
- **Cons**: Requires reliable delivery, ordering

### Delta Sync
- Send only changed fields
- **Pros**: Bandwidth efficient
- **Cons**: Complex diff computation

## Tombstones

Tombstones preserve deletion information to prevent deleted data from reappearing during sync [3].

```typescript
// Without tombstones:
Peer A: deletes doc-1
Peer B: has old copy of doc-1
Peer B syncs → doc-1 reappears on Peer A!

// With tombstones:
Peer A: deletes doc-1, creates tombstone
Peer B syncs → receives tombstone for doc-1
Peer B: deletes its local doc-1
```

## Offline-First Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   UI     │────►│  Local   │────►│  Sync    │
│  Layer   │     │  Store   │     │  Engine  │
└──────────┘     └──────────┘     └────┬─────┘
     ▲                                  │
     └──────────────────────────────────┘
              (on connectivity)
```

Principles:
1. **Local First**: All reads/writes go to local store immediately
2. **Async Sync**: Sync happens in background
3. **Conflict Resolution**: Automatic merging with CRDTs
4. **Queueing**: Pending changes queued when offline

## References

[1] Shapiro, M., et al. "Conflict-free Replicated Data Types." SSS 2011.
[2] "Version Vectors Are Not Vector Clocks," IEEE, 2010.
[3] "Delta State Replicated Data Types," Almeida et al., 2016.
[4] Kleppmann, M. *Designing Data-Intensive Applications*, Chapter 9.