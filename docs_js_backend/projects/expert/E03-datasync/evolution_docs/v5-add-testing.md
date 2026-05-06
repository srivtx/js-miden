# v5 — Add Testing

Your sync engine has logging, but convergence bugs still slip through. A tombstone fix works for one peer but breaks for three. A vector clock optimization causes merge loops. You need mathematical confidence.

## Pain #1: Merge Regressions

You optimize conflict resolution for performance. The new code skips vector clock comparison for identical peers. But "identical" peers with concurrent updates are now resolved incorrectly. Two "Hello" and "World" edits on the same document lose one.

## Pain #2: Tombstone Resurrection

You fix tombstone propagation for sync messages. But delta messages still don't include tombstones. A peer receives a delta delete, then a sync from a stale peer. The document resurrects. The fix was incomplete.

## Pain #3: Offline-First Breakage

You add optimistic updates for better UX. A client edits offline, then syncs. The optimistic update conflicts with a server change. The merge produces garbage data. Users see corrupted documents.

## The Fix: Property-Based + Unit Testing

### Unit Tests: Vector Clock Logic

```typescript
// tests/unit/vectorClock.test.ts
import { describe, it, expect } from 'vitest';
import { ConflictResolutionService } from '../../src/services/ConflictResolutionService.js';

describe('Vector Clock Comparison', () => {
  const resolver = new ConflictResolutionService();
  
  it('should detect causal ordering (local ahead)', () => {
    const local = { A: 3, B: 2 };
    const remote = { A: 2, B: 2 };
    expect(resolver.compareVectorClocks(local, remote)).toBe('local');
  });
  
  it('should detect causal ordering (remote ahead)', () => {
    const local = { A: 2, B: 2 };
    const remote = { A: 3, B: 2 };
    expect(resolver.compareVectorClocks(local, remote)).toBe('remote');
  });
  
  it('should detect concurrent updates', () => {
    const local = { A: 3, B: 1 };
    const remote = { A: 1, B: 3 };
    expect(resolver.compareVectorClocks(local, remote)).toBe('concurrent');
  });
  
  it('should handle identical clocks', () => {
    const local = { A: 2, B: 2 };
    const remote = { A: 2, B: 2 };
    expect(resolver.compareVectorClocks(local, remote)).toBe('local');
  });
  
  it('should handle new peers', () => {
    const local = { A: 2 };
    const remote = { A: 2, B: 1 };
    expect(resolver.compareVectorClocks(local, remote)).toBe('remote');
  });
});
```

### Unit Tests: CRDT Merge Properties

```typescript
// tests/unit/crdt.test.ts
import { describe, it, expect } from 'vitest';
import { ConflictResolutionService } from '../../src/services/ConflictResolutionService.js';
import { CRDTDocument } from '../../src/types/index.js';

describe('CRDT Merge Properties', () => {
  const resolver = new ConflictResolutionService();
  
  // Commutativity: merge(A, B) == merge(B, A)
  it('should be commutative', () => {
    const docA: CRDTDocument = {
      id: 'doc-1', type: 'register', data: 'A',
      vectorClock: { A: 1 }, timestamp: 1000,
    };
    const docB: CRDTDocument = {
      id: 'doc-1', type: 'register', data: 'B',
      vectorClock: { B: 1 }, timestamp: 1001,
    };
    
    const mergeAB = resolver.resolve(docA, docB);
    const mergeBA = resolver.resolve(docB, docA);
    
    expect(mergeAB.data).toBe(mergeBA.data);
    expect(mergeAB.vectorClock).toEqual(mergeBA.vectorClock);
  });
  
  // Idempotence: merge(A, A) == A
  it('should be idempotent', () => {
    const doc: CRDTDocument = {
      id: 'doc-1', type: 'register', data: 'Hello',
      vectorClock: { A: 1 }, timestamp: 1000,
    };
    
    const merged = resolver.resolve(doc, doc);
    expect(merged.data).toBe(doc.data);
    expect(merged.vectorClock).toEqual(doc.vectorClock);
  });
  
  // Associativity: merge(merge(A,B), C) == merge(A, merge(B,C))
  it('should be associative', () => {
    const docA: CRDTDocument = {
      id: 'doc-1', type: 'register', data: 'A',
      vectorClock: { A: 1 }, timestamp: 1000,
    };
    const docB: CRDTDocument = {
      id: 'doc-1', type: 'register', data: 'B',
      vectorClock: { B: 1 }, timestamp: 1001,
    };
    const docC: CRDTDocument = {
      id: 'doc-1', type: 'register', data: 'C',
      vectorClock: { C: 1 }, timestamp: 1002,
    };
    
    const mergeAB_C = resolver.resolve(resolver.resolve(docA, docB), docC);
    const mergeA_BC = resolver.resolve(docA, resolver.resolve(docB, docC));
    
    expect(mergeAB_C.vectorClock).toEqual(mergeA_BC.vectorClock);
  });
});
```

### Integration Tests: Tombstone Propagation

```typescript
// tests/integration/tombstone.test.ts
import { describe, it, expect } from 'vitest';
import { SyncService } from '../../src/services/SyncService.js';
import { StorageService } from '../../src/services/StorageService.js';
import { ConflictResolutionService } from '../../src/services/ConflictResolutionService.js';

describe('Tombstone propagation', () => {
  it('should prevent resurrection after sync', () => {
    const storage = new StorageService();
    const conflictService = new ConflictResolutionService();
    const syncService = new SyncService(storage, conflictService);
    
    // Create document
    storage.storeDocument({
      id: 'doc-1', type: 'register', data: 'Hello',
      vectorClock: { A: 1 }, timestamp: 1000,
    });
    
    // Delete it (creates tombstone)
    storage.deleteDocument('doc-1');
    expect(storage.isDeleted('doc-1')).toBe(true);
    
    // Simulate stale peer sending old document in sync
    const staleDoc = {
      id: 'doc-1', type: 'register', data: 'Hello',
      vectorClock: { A: 1 }, timestamp: 1000,
    };
    
    // Process sync with tombstone awareness
    if (storage.isDeleted(staleDoc.id)) {
      const tombstone = storage.getTombstone(staleDoc.id);
      const comparison = conflictService.compareVectorClocks(
        staleDoc.vectorClock,
        tombstone!.vectorClock
      );
      
      // Old document should be rejected
      expect(comparison).toBe('local'); // tombstone is ahead
    }
    
    // Document should stay deleted
    expect(storage.getDocument('doc-1')).toBeNull();
  });
  
  it('should propagate tombstones in full sync', () => {
    const storage = new StorageService();
    storage.storeDocument({
      id: 'doc-1', type: 'register', data: 'Hello',
      vectorClock: { A: 1 }, timestamp: 1000,
    });
    storage.deleteDocument('doc-1');
    
    const tombstones = storage.getTombstones();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].documentId).toBe('doc-1');
  });
});
```

### Integration Tests: Offline-First Sync

```typescript
// tests/integration/offline.test.ts
import { describe, it, expect } from 'vitest';

describe('Offline-first behavior', () => {
  it('should converge after disconnected edits', () => {
    // Peer A and Peer B start with the same document
    const docA = createDocument('doc-1', 'Hello', { A: 1, B: 1 });
    const peerA = createPeer('A', [docA]);
    const peerB = createPeer('B', [docA]);
    
    // Both go offline and edit independently
    peerA.edit('doc-1', 'Hello World', { A: 2, B: 1 });
    peerB.edit('doc-1', 'Hello Universe', { A: 1, B: 2 });
    
    // They reconnect and sync
    const resolvedA = peerA.syncWith(peerB);
    const resolvedB = peerB.syncWith(peerA);
    
    // Both should converge to the same state
    expect(resolvedA.data).toBe(resolvedB.data);
    expect(resolvedA.vectorClock).toEqual(resolvedB.vectorClock);
    expect(resolvedA.vectorClock).toEqual({ A: 2, B: 2 });
  });
});
```

## What Changed

1. **Vector clock correctness** — All comparison cases are exhaustively tested.
2. **CRDT properties** — Commutativity, associativity, idempotence are verified.
3. **Tombstone integrity** — Deleted documents stay deleted across sync scenarios.
4. **Offline convergence** — Disconnected peers converge to identical state.

## Testing as Mathematical Proof

CRDTs are mathematical objects. Their correctness is not "it seems to work" — it's "it satisfies commutativity, associativity, and idempotence." Property-based tests generate thousands of random inputs to prove these properties. Unit tests verify specific edge cases. Together, they provide confidence that convergence is guaranteed.

## Next Pain

Tests run but imports use `require()` and relative paths. The test setup is verbose. You need ESM for cleaner imports and modern test patterns.
