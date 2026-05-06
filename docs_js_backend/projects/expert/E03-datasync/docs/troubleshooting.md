# Troubleshooting

## Known Bugs

### Bug 1: No Tombstones in Sync (CRITICAL)

**Symptom**: User deletes a document on Device A. Later, Device B syncs and the deleted document reappears.

**Root Cause**: `StorageService` stores tombstones but `SyncService` never includes them in sync messages. When a peer with an old version syncs, the document is recreated.

**Location**: `src/services/SyncService.ts`, `src/services/StorageService.ts`

**Buggy Code**:
```typescript
// SyncService.ts
private handleSyncRequest(peerId, message) {
  const documents = this.storage.getAllDocuments();
  const response = {
    type: 'sync',
    peerId: 'server',
    documents,  // BUG: No tombstones included!
    vectorClock: this.storage.getGlobalVectorClock(),
  };
  this.sendToPeer(peerId, response);
}

// StorageService.ts
getAllDocuments() {
  // BUG: Returns all documents, doesn't tell peers about deletions
  return Array.from(this.documents.values());
}
```

**Impact**:
- Deleted data resurrects during sync
- Users see "ghost" documents
- Violates user expectations of deletion

**Fix**: Include tombstones in sync:
```typescript
private handleSyncRequest(peerId, message) {
  const documents = this.storage.getAllDocuments();
  const tombstones = this.storage.getTombstones(); // Include tombstones!
  const response = {
    type: 'sync',
    documents,
    tombstones,  // Fixed!
    vectorClock: this.storage.getGlobalVectorClock(),
  };
}

// StorageService.ts
getAllDocuments() {
  const docs = Array.from(this.documents.values());
  // Filter out documents that are tombstoned
  return docs.filter(doc => !this.tombstones.has(doc.id));
}
```

**Test**: `tests/sync.test.ts` - "BUG: Deleted documents come back during sync"

## Common Issues

### Vector Clock Merge Errors
- Symptom: Old data overwrites new data
- Cause: Incorrect vector clock merge logic
- Fix: Use component-wise max: `merged[peer] = max(a[peer], b[peer])`

### Full Sync Bandwidth Explosion
- Symptom: Initial sync takes too long
- Cause: Sending all documents instead of deltas
- Fix: Implement delta encoding and state-based diffs

## Debug Logging

```bash
DEBUG=datasync:* npm run dev
```

## References

[1] "Tombstones in Distributed Systems," Martin Kleppmann, 2018.
[2] "Delta State Replicated Data Types," Almeida et al., 2016.