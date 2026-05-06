# Testing Guide

## Test Structure

```
tests/
├── sync.test.ts         # Sync protocol (contains bug test)
├── crdt.test.ts         # CRDT merge logic
├── storage.test.ts      # Document storage
└── presence.test.ts     # Presence tracking
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Test Categories

### Sync Protocol Tests

```typescript
describe('SyncService', () => {
  it('BUG: Deleted documents come back during sync', () => {
    // 1. Create document
    storage.storeDocument(doc);
    // 2. Delete it
    storage.deleteDocument('doc-1');
    // 3. New peer connects and requests sync
    syncService.handleMessage('peer-2', { type: 'sync' });
    // 4. Bug: Sync response has no tombstones!
    const response = JSON.parse(ws2.send.mock.calls[0][0]);
    expect(response.documents).toHaveLength(0);
    expect(response.tombstones).toBeUndefined(); // BUG
  });
});
```

### CRDT Tests

- Vector clock comparison
- Concurrent update merging
- Document conflict resolution
- Merge count tracking

### Storage Tests

- Document lifecycle
- Tombstone tracking
- Global vector clock computation
- Deleted document filtering

### Load Testing

Simulate many concurrent editors:

```bash
npm install -g artillery
artillery quick --count 100 -d 60 ws://localhost:3000
```

## References

[1] Vitest Documentation. https://vitest.dev/
[2] "Testing Distributed Systems," Martin Kleppmann, 2020.