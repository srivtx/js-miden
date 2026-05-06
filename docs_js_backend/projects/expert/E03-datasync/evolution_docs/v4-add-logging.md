# v4 — Add Logging

Your sync engine handles CRDT merges, tombstone propagation, and conflict resolution across peers. When convergence fails, you have no record of what operations were processed in what order.

## Pain #1: Merge Failures Without History

```typescript
// SyncService.ts (before)
handleDelta(peerId: string, message: SyncMessage): void {
  for (const op of message.delta || []) {
    console.log('Processing delta', op.type, op.documentId);
    // ...
  }
}
```

Two peers diverge after sync. The log says `"Processing delta set doc-1"` 50 times. You can't determine:
- The vector clock of each operation
- The previous document state before merge
- The resolved document state after merge
- Which peer sent which operation

## Pain #2: Tombstone Propagation Blindness

```typescript
// StorageService.ts (before)
deleteDocument(id: string): void {
  console.log('Deleting document', id);
  const doc = this.documents.get(id);
  if (doc) {
    this.tombstones.set(id, { documentId: id, deletedAt: Date.now(), vectorClock: doc.vectorClock });
    this.documents.delete(id);
  }
}
```

A deleted document resurrects on another peer. The logs show the deletion locally but don't track:
- Whether the tombstone was sent to peers
- Which peers acknowledged it
- The vector clock at deletion time
- Whether the tombstone was included in sync responses

## Pain #3: Presence Leaks

```typescript
// PresenceService.ts (before)
connectPeer(peerId: string): void {
  console.log('Peer connected', peerId);
  this.peers.set(peerId, { status: 'online', lastSeen: Date.now() });
}
```

A peer disconnects but still appears online. The log says they connected but never logged the disconnect. You can't debug presence state without full lifecycle tracking.

## The Fix: Structured Logging with Context

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'datasync',
    version: process.env.npm_package_version || '1.0.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createSyncLogger(peerId: string) {
  return logger.child({ peerId, context: 'sync' });
}

export function createMergeLogger(documentId: string, localClock: VectorClock, remoteClock: VectorClock) {
  return logger.child({ documentId, localClock, remoteClock, context: 'merge' });
}
```

```typescript
// src/services/SyncService.ts
import { logger, createSyncLogger } from '../utils/logger.js';

handleDelta(peerId: string, message: SyncMessage): void {
  const log = createSyncLogger(peerId);
  log.info({ deltaCount: message.delta?.length }, 'Received delta message');

  for (const op of message.delta || []) {
    const opLog = log.child({ documentId: op.documentId, opType: op.type, vectorClock: op.vectorClock });
    
    try {
      if (op.type === 'set') {
        const existing = this.storage.getDocument(op.documentId);
        if (existing) {
          const resolved = this.conflictService.resolve(existing, {
            id: op.documentId,
            type: 'register',
            data: op.value,
            vectorClock: op.vectorClock,
            timestamp: Date.now(),
          });
          opLog.info(
            { previousClock: existing.vectorClock, resolvedClock: resolved.vectorClock },
            'Document merged'
          );
          this.storage.storeDocument(resolved);
        } else {
          opLog.info('New document stored');
          this.storage.storeDocument({
            id: op.documentId,
            type: 'register',
            data: op.value,
            vectorClock: op.vectorClock,
            timestamp: Date.now(),
          });
        }
      } else if (op.type === 'delete') {
        this.storage.deleteDocument(op.documentId);
        opLog.info('Document deleted and tombstone created');
      }
    } catch (error: any) {
      opLog.error({ err: error }, 'Failed to process delta operation');
    }
  }
}
```

```typescript
// src/services/StorageService.ts
import { logger } from '../utils/logger.js';

deleteDocument(id: string): void {
  const doc = this.documents.get(id);
  if (doc) {
    const tombstone: TombstoneEntry = {
      documentId: id,
      deletedAt: Date.now(),
      vectorClock: { ...doc.vectorClock },
    };
    this.tombstones.set(id, tombstone);
    this.documents.delete(id);
    logger.info({ documentId: id, tombstone }, 'Document deleted, tombstone stored');
  }
}

getAllDocuments(): CRDTDocument[] {
  const docs = Array.from(this.documents.values());
  logger.debug({ count: docs.length, tombstoneCount: this.tombstones.size }, 'Retrieved all documents');
  return docs;
}

getTombstones(): TombstoneEntry[] {
  const tombstones = Array.from(this.tombstones.values());
  logger.debug({ count: tombstones.length }, 'Retrieved tombstones');
  return tombstones;
}
```

## Log Output Example

```json
{
  "level": 30,
  "time": "2025-01-15T11:45:22.789Z",
  "service": "datasync",
  "version": "1.0.0",
  "peerId": "peer-laptop-abc",
  "context": "sync",
  "documentId": "doc-1",
  "opType": "set",
  "vectorClock": { "peer-laptop-abc": 3, "peer-phone-def": 2 },
  "previousClock": { "peer-laptop-abc": 2, "peer-phone-def": 2 },
  "resolvedClock": { "peer-laptop-abc": 3, "peer-phone-def": 2 },
  "msg": "Document merged"
}
```

## What Changed

1. **Merge transparency** — Every merge logs local clock, remote clock, and resolved clock.
2. **Tombstone tracking** — Deletions log the full tombstone entry.
3. **Peer lifecycle** — Connect, disconnect, sync events are fully logged.
4. **Error causality** — Failed operations include the full operation context.

## Logging as Convergence Debugging

In CRDT systems, bugs manifest as divergence: two peers have different states that should be the same. Without structured logs showing every vector clock transition, divergence is impossible to debug. Logging is the audit trail for mathematical correctness.

## Next Pain

You fix a tombstone bug and hope it works. But you have no test that verifies deleted documents stay deleted across sync. You need automated testing.
