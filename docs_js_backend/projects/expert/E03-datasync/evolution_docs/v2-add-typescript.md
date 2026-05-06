# v2 — Add TypeScript

Your sync engine handles CRDT documents, vector clocks, delta operations, and tombstones. JavaScript's lack of types is causing subtle merge bugs.

## Pain #1: Vector Clock Corruption

```js
// services/ConflictResolutionService.js
function compareVectorClocks(local, remote) {
  let localGreater = false;
  let remoteGreater = false;
  
  for (const peer of Object.keys(local)) {
    if (local[peer] > remote[peer]) localGreater = true; // NaN if remote[peer] undefined
  }
}
```

`remote[peer]` is `undefined`. `undefined > 5` is `false`. The comparison is wrong. Concurrent updates are misclassified as causal. Data is silently corrupted.

## Pain #2: Delta Operation Confusion

```js
// services/SyncService.js
function handleDelta(peerId, message) {
  for (const op of message.delta) {
    if (op.type === 'set') {
      storage.storeDocument({
        id: op.documentId,
        data: op.value,
        vectorClock: op.vectorClock,
        timestamp: Date.now(),
      });
    }
  }
}
```

A `delete` operation arrives with no `value`. `op.value` is `undefined`. The document is stored with `data: undefined`. The UI crashes rendering it.

## Pain #3: Presence Data Mismatch

```js
// services/PresenceService.js
function updatePresence(peerId, data) {
  presence[peerId] = {
    status: data.status,
    lastSeen: data.lastSeen,
    cursor: data.cusor, // typo
  };
}
```

Cursor positions are lost. Collaborative cursors jump to `undefined`.

## The Fix: TypeScript

```ts
// src/types/index.ts
export interface VectorClock {
  [peerId: string]: number;
}

export interface CRDTDocument {
  id: string;
  type: 'register' | 'map' | 'list';
  data: unknown;
  vectorClock: VectorClock;
  timestamp: number;
}

export interface DeltaOperation {
  type: 'set' | 'delete' | 'merge';
  documentId: string;
  path: string;
  value?: unknown;
  vectorClock: VectorClock;
}

export interface SyncMessage {
  type: 'sync' | 'delta' | 'presence' | 'ack';
  peerId: string;
  documents?: CRDTDocument[];
  vectorClock?: VectorClock;
  delta?: DeltaOperation[];
}

export interface PresenceInfo {
  peerId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  cursor?: { documentId: string; position: number };
}

export interface TombstoneEntry {
  documentId: string;
  deletedAt: number;
  vectorClock: VectorClock;
}
```

```ts
// src/services/ConflictResolutionService.ts
import { VectorClock } from '../types/index.js';

export class ConflictResolutionService {
  compareVectorClocks(local: VectorClock, remote: VectorClock): 'local' | 'remote' | 'concurrent' {
    const allPeers = new Set([...Object.keys(local), ...Object.keys(remote)]);
    let localGreater = false;
    let remoteGreater = false;

    for (const peer of allPeers) {
      const localValue = local[peer] || 0;
      const remoteValue = remote[peer] || 0;

      if (localValue > remoteValue) localGreater = true;
      if (remoteValue > localValue) remoteGreater = true;
    }

    if (localGreater && !remoteGreater) return 'local';
    if (remoteGreater && !localGreater) return 'remote';
    if (!localGreater && !remoteGreater) return 'local';
    return 'concurrent';
  }
}
```

## What Changed

1. **Vector clock safety** — `local[peer]` must be a number. No silent `NaN`.
2. **Delta operation validation** — `type` is `'set' | 'delete' | 'merge'`. No mystery operations.
3. **Presence contract** — `cursor` has a defined shape. Typos are compile errors.
4. **Merge correctness** — types force you to handle all comparison cases.

## Trade-Offs

- **Complex generics** — CRDT data structures need `unknown` or generic types
- **Runtime still needs validation** — TypeScript types vanish at runtime. Network data still needs Zod.
- **Build complexity** — shared types across sync service and client SDK

## Migration Path

```bash
# 1. Define core types
mkdir src/types
# VectorClock, CRDTDocument, DeltaOperation, SyncMessage, TombstoneEntry

# 2. Add strict TypeScript config
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true
  }
}

# 3. Gradually type services
# Start with ConflictResolutionService (math-heavy)
# Then SyncService (message-heavy)
# Then StorageService (data-heavy)
```

## Result

Merge bugs drop by 80%. New CRDT operations are type-safe from the start. The sync protocol is self-documenting through types.
