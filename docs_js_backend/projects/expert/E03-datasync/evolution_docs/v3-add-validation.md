# v3 — Add Validation

Your sync engine receives messages from untrusted clients over WebSocket. TypeScript types vanish at runtime. A malformed delta can corrupt the entire document store.

## Pain #1: Invalid Delta Operations

```typescript
// SyncService.ts (before)
handleMessage(peerId: string, message: SyncMessage): void {
  for (const op of message.delta || []) {
    if (op.type === 'set') {
      // op.documentId might be undefined
      // op.vectorClock might be a string
      this.storage.storeDocument({
        id: op.documentId,
        data: op.value,
        vectorClock: op.vectorClock,
        timestamp: Date.now(),
      });
    }
  }
}
```

A malicious client sends `{ type: 'set', documentId: null, vectorClock: 'hacked' }`. The storage service crashes. Other peers receive corrupted data.

## Pain #2: Vector Clock Poisoning

```typescript
// A bad peer sends:
{
  type: 'delta',
  peerId: 'peer-a',
  delta: [{
    type: 'set',
    documentId: 'doc-1',
    vectorClock: { 'peer-a': 999999 }, // Artificially inflated
    value: 'malicious data',
  }]
}
```

The conflict resolver sees `{ peer-a: 999999 }` and always chooses the malicious version. The attacker owns the document.

## Pain #3: Tombstone Resurrection

```typescript
// A stale peer sends an old document without checking tombstones
{
  type: 'sync',
  peerId: 'peer-b',
  documents: [{
    id: 'deleted-doc',
    data: 'old version',
    vectorClock: { 'peer-b': 1 },
    timestamp: 1000,
  }]
}
```

No validation checks if the document was deleted. The deleted document comes back.

## The Fix: Zod Validation for Sync Messages

```typescript
// src/validation/sync.ts
import { z } from 'zod';

export const VectorClockSchema = z.record(z.string().min(1), z.number().int().min(0));

export const DeltaOperationSchema = z.object({
  type: z.enum(['set', 'delete', 'merge']),
  documentId: z.string().min(1).max(256),
  path: z.string().min(1).max(1024),
  value: z.unknown().optional(),
  vectorClock: VectorClockSchema,
});

export const SyncMessageSchema = z.object({
  type: z.enum(['sync', 'delta', 'presence', 'ack']),
  peerId: z.string().min(1).max(256),
  documents: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['register', 'map', 'list']),
    data: z.unknown(),
    vectorClock: VectorClockSchema,
    timestamp: z.number().int().min(0),
  })).optional(),
  vectorClock: VectorClockSchema.optional(),
  delta: z.array(DeltaOperationSchema).optional(),
});

export const PresenceMessageSchema = z.object({
  type: z.literal('presence'),
  peerId: z.string().min(1),
  status: z.enum(['online', 'offline', 'away']),
  lastSeen: z.number().int().min(0),
  cursor: z.object({
    documentId: z.string().min(1),
    position: z.number().int().min(0),
  }).optional(),
});
```

```typescript
// src/services/SyncService.ts
import { SyncMessageSchema } from '../validation/sync.js';

handleMessage(peerId: string, rawMessage: unknown): void {
  const result = SyncMessageSchema.safeParse(rawMessage);
  if (!result.success) {
    logError('Invalid sync message', { peerId, errors: result.error.issues });
    return;
  }

  const message = result.data;
  
  switch (message.type) {
    case 'sync':
      this.handleSyncRequest(peerId, message);
      break;
    case 'delta':
      // Validate vector clock monotonicity
      for (const op of message.delta || []) {
        if (!this.isValidVectorClock(op.vectorClock, peerId)) {
          logError('Invalid vector clock', { peerId, vectorClock: op.vectorClock });
          return;
        }
      }
      this.handleDelta(peerId, message);
      break;
  }
}

private isValidVectorClock(clock: VectorClock, peerId: string): boolean {
  const peerValue = clock[peerId];
  if (peerValue === undefined) return false;
  // Peer can't claim a value more than 1 ahead of what we've seen
  const known = this.documentVersions.get(peerId) || 0;
  return peerValue <= known + 1;
}
```

## What Changed

1. **Message integrity** — Every sync message is validated before processing.
2. **Vector clock safety** — Monotonicity is enforced. No artificial inflation.
3. **Document sanity** — `documentId` must be a string. `timestamp` must be a number.
4. **Graceful rejection** — Invalid messages are logged and dropped. No crashes.

## Validation as Convergence Protection

In a CRDT system, one invalid message can poison the entire network. Validation ensures that only well-formed operations enter the merge process. Convergence depends on it.

## Next Pain

When sync conflicts occur, you have no record of what happened. `console.log` statements are scattered and inconsistent. You need structured logging.
