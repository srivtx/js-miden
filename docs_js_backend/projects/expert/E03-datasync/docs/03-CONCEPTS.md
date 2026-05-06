# E03 Data Sync: Core Concepts

## WHAT: CRDT-Based Real-Time Synchronization

CRDTs are data structures that can be edited independently on multiple peers and automatically merge into a consistent state when those peers communicate.

```
┌─────────────────────────────────────────────────────────────┐
│                    CRDT SYNCHRONIZATION                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PEER A                      SERVER                      PEER B│
│  ──────                      ──────                      ─────│
│     │                          │                          │   │
│     │ Create "Hello"           │                          │   │
│     │ VC: {A:1}                │                          │   │
│     │                          │                          │   │
│     │ ─────── delta ──────────▶│                          │   │
│     │                          │ ─────── broadcast ──────▶│   │
│     │                          │                          │   │
│     │                          │                     Store│   │
│     │                          │                     VC:{A:1}│
│     │                          │                          │   │
│     │                          │◀────── delta ────────────│   │
│     │                          │                          │   │
│     │ Edit → "Hello World"     │                          │   │
│     │ VC: {A:2}                │                          │   │
│     │                          │                          │   │
│     │ ─────── delta ──────────▶│                          │   │
│     │                          │ ─────── broadcast ──────▶│   │
│     │                          │                          │   │
│     │                          │                     Merge│   │
│     │                          │                     VC:{A:2}│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## WHY: Why CRDTs and Tombstones?

### Why Not Just Use a Database?
Because databases are centralized. If the server is down, no one can write. If a user is on a plane, they can't edit. CRDTs enable **offline-first** applications.

### Why Vector Clocks?
Because wall-clock time lies. Peer A's clock says 10:00:00. Peer B's clock says 10:00:05. Which edit happened "first"? We don't know, and it doesn't matter. What matters is causality: did B see A's edit before making its own?

```
A edits at {A:1}
B receives A's edit
B edits at {A:1, B:1}  ← Causal! B knew about A's edit.

A edits at {A:1}
B edits at {B:1}        ← Concurrent! B did NOT know about A's edit.
                        → Both edits are valid. Must merge.
```

### Why Tombstones?
Because deletions are information too. If Alice deletes a document and Bob never hears about it, Bob's stale copy will resurrect on the next sync. A tombstone is a permanent record that says "this document was deleted at vector clock X."

```
WITHOUT TOMBSTONES:
  A: Deletes doc-1
  B: Has old doc-1, never hears about deletion
  B syncs → sends doc-1 to A
  A: "doc-1 is back?! I deleted it!"

WITH TOMBSTONES:
  A: Deletes doc-1, creates tombstone {doc-1, deleted, VC:{A:2}}
  B: Syncs, receives tombstone
  B: Deletes local doc-1
  B: Future syncs ignore doc-1 because tombstone exists
```

## HOW: Correct CRDT Sync

### Sync Message with Tombstones
```typescript
interface SyncMessage {
  type: 'sync';
  peerId: string;
  documents: CRDTDocument[];
  tombstones: TombstoneEntry[];  // MUST include tombstones!
  vectorClock: VectorClock;
}
```

### Handling a Sync Request
```typescript
private handleSyncRequest(peerId: string, message: SyncMessage): void {
  const documents = this.storage.getAllDocuments();
  const tombstones = this.storage.getTombstones();

  const response: SyncMessage = {
    type: 'sync',
    peerId: 'server',
    documents,
    tombstones,  // CORRECT: Send tombstones so peers know what's deleted
    vectorClock: this.storage.getGlobalVectorClock(),
  };

  this.sendToPeer(peerId, response);
}
```

### Handling Incoming Documents
```typescript
private handleIncomingDocuments(docs: CRDTDocument[], tombstones: TombstoneEntry[]): void {
  // 1. Apply tombstones first
  for (const tombstone of tombstones) {
    this.storage.deleteDocument(tombstone.documentId);
  }

  // 2. Merge documents, checking against tombstones
  for (const doc of docs) {
    if (this.storage.isDeleted(doc.id)) {
      // This document was deleted. Check if the incoming version is newer.
      const tombstone = this.storage.getTombstone(doc.id);
      const comparison = compareVectorClocks(doc.vectorClock, tombstone.vectorClock);
      
      if (comparison === 'concurrent' || comparison === 'remote') {
        // Incoming document is concurrent with or newer than deletion.
        // This is a conflict. For LWW, compare timestamps.
        if (doc.timestamp > tombstone.deletedAt) {
          this.storage.storeDocument(doc);
        }
      }
      // If doc is older than tombstone, ignore it.
      continue;
    }

    const existing = this.storage.getDocument(doc.id);
    if (existing) {
      const resolved = this.conflictService.resolve(existing, doc);
      this.storage.storeDocument(resolved);
    } else {
      this.storage.storeDocument(doc);
    }
  }
}
```

## WRONG vs RIGHT

### WRONG: Sync Without Tombstones
```typescript
// BUG: Deleted documents come back!
private handleSyncRequest(peerId: string, message: SyncMessage): void {
  const documents = this.storage.getAllDocuments();
  const response: SyncMessage = {
    type: 'sync',
    peerId: 'server',
    documents,           // Only sends documents
    // tombstones: ???   // Missing! Peers never learn about deletions.
    vectorClock: this.storage.getGlobalVectorClock(),
  };
  this.sendToPeer(peerId, response);
}
```

**Why it's wrong**: If Peer B deleted a document, but Peer A never received the tombstone, Peer A will resurrect the document on its next sync. The deletion is lost.

### RIGHT: Propagate Tombstones in Every Sync
```typescript
// CORRECT: Include tombstones in sync responses
const response: SyncMessage = {
  type: 'sync',
  peerId: 'server',
  documents: this.storage.getAllDocuments(),
  tombstones: this.storage.getTombstones(),  // ← CRITICAL
  vectorClock: this.storage.getGlobalVectorClock(),
};
```

### WRONG: Deleting Without Creating a Tombstone
```typescript
// BUG: Local delete, no record for peers
this.storage.deleteDocument(id); // Removes from documents map
// But no tombstone is created or propagated
```

### RIGHT: Create and Propagate Tombstone on Delete
```typescript
// CORRECT: Create tombstone, propagate in deltas
this.storage.deleteDocument(id); // Creates local tombstone

const delta: DeltaOperation = {
  type: 'delete',
  documentId: id,
  vectorClock: incrementVectorClock(this.localClock, this.peerId),
  path: '/',
};

this.broadcastDelta(peerId, [delta]); // Peers receive the deletion
```
