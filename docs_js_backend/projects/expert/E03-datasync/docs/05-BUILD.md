# E03 Data Sync: Build Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Basic understanding of WebSockets and distributed systems

## Step 1: Project Setup

```bash
mkdir datasync && cd datasync
npm init -y
npm install ws
npm install -D typescript vitest @types/ws @types/node
npx tsc --init
```

## Step 2: Type Definitions

Create `src/types/index.ts`:
```typescript
export interface CRDTDocument {
  id: string;
  type: 'register' | 'map' | 'list';
  data: unknown;
  vectorClock: VectorClock;
  timestamp: number;
}

export interface VectorClock {
  [peerId: string]: number;
}

export interface SyncMessage {
  type: 'sync' | 'delta' | 'ack';
  peerId: string;
  documents?: CRDTDocument[];
  tombstones?: TombstoneEntry[];
  vectorClock?: VectorClock;
  delta?: DeltaOperation[];
}

export interface DeltaOperation {
  type: 'set' | 'delete' | 'merge';
  documentId: string;
  path: string;
  value?: unknown;
  vectorClock: VectorClock;
}

export interface TombstoneEntry {
  documentId: string;
  deletedAt: number;
  vectorClock: VectorClock;
}
```

## Step 3: Storage Service (CORRECT)

Create `src/services/StorageService.ts`:
```typescript
import { CRDTDocument, VectorClock, TombstoneEntry } from '../types/index.js';

export class StorageService {
  private documents: Map<string, CRDTDocument> = new Map();
  private tombstones: Map<string, TombstoneEntry> = new Map();
  private globalClock: VectorClock = {};

  storeDocument(doc: CRDTDocument): void {
    this.documents.set(doc.id, doc);
    this.updateGlobalClock(doc.vectorClock);
  }

  getDocument(id: string): CRDTDocument | null {
    // CORRECT: Check tombstones before returning
    if (this.tombstones.has(id)) return null;
    return this.documents.get(id) || null;
  }

  deleteDocument(id: string): void {
    const doc = this.documents.get(id);
    if (doc) {
      this.tombstones.set(id, {
        documentId: id,
        deletedAt: Date.now(),
        vectorClock: { ...doc.vectorClock },
      });
      this.documents.delete(id);
    }
  }

  getAllDocuments(): CRDTDocument[] {
    // CORRECT: Only return non-deleted documents
    return Array.from(this.documents.values()).filter(d => !this.tombstones.has(d.id));
  }

  getTombstones(): TombstoneEntry[] {
    return Array.from(this.tombstones.values());
  }

  isDeleted(id: string): boolean {
    return this.tombstones.has(id);
  }

  getGlobalVectorClock(): VectorClock {
    return { ...this.globalClock };
  }

  private updateGlobalClock(clock: VectorClock): void {
    for (const [peer, count] of Object.entries(clock)) {
      this.globalClock[peer] = Math.max(this.globalClock[peer] || 0, count);
    }
  }
}
```

## Step 4: Conflict Resolution Service

Create `src/services/ConflictResolutionService.ts`:
```typescript
import { CRDTDocument, VectorClock } from '../types/index.js';

export class ConflictResolutionService {
  resolve(local: CRDTDocument, remote: CRDTDocument): CRDTDocument {
    const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);

    if (comparison === 'local') return local;
    if (comparison === 'remote') return remote;

    // Concurrent: LWW merge
    const winner = local.timestamp > remote.timestamp ? local : remote;
    return {
      ...winner,
      vectorClock: this.mergeVectorClocks(local.vectorClock, remote.vectorClock),
      timestamp: Math.max(local.timestamp, remote.timestamp),
    };
  }

  compareVectorClocks(local: VectorClock, remote: VectorClock): 'local' | 'remote' | 'concurrent' {
    const allPeers = new Set([...Object.keys(local), ...Object.keys(remote)]);
    let localGreater = false;
    let remoteGreater = false;

    for (const peer of allPeers) {
      const lv = local[peer] || 0;
      const rv = remote[peer] || 0;
      if (lv > rv) localGreater = true;
      if (rv > lv) remoteGreater = true;
    }

    if (localGreater && !remoteGreater) return 'local';
    if (remoteGreater && !localGreater) return 'remote';
    return 'concurrent';
  }

  private mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
    const merged: VectorClock = {};
    for (const peer of new Set([...Object.keys(a), ...Object.keys(b)])) {
      merged[peer] = Math.max(a[peer] || 0, b[peer] || 0);
    }
    return merged;
  }
}
```

## Step 5: Sync Service (CORRECT)

Create `src/services/SyncService.ts`:
```typescript
import { SyncMessage, CRDTDocument } from '../types/index.js';
import { StorageService } from './StorageService.js';
import { ConflictResolutionService } from './ConflictResolutionService.js';

export class SyncService {
  private peers = new Map<string, WebSocket>();

  constructor(
    private storage: StorageService,
    private conflictService: ConflictResolutionService
  ) {}

  connectPeer(peerId: string, ws: WebSocket): void {
    this.peers.set(peerId, ws);
    this.sendFullSync(peerId);
  }

  handleMessage(peerId: string, message: SyncMessage): void {
    switch (message.type) {
      case 'sync': this.handleSyncRequest(peerId, message); break;
      case 'delta': this.handleDelta(peerId, message); break;
    }
  }

  private handleSyncRequest(peerId: string, _message: SyncMessage): void {
    const response: SyncMessage = {
      type: 'sync',
      peerId: 'server',
      documents: this.storage.getAllDocuments(),
      tombstones: this.storage.getTombstones(),  // ← CRITICAL
      vectorClock: this.storage.getGlobalVectorClock(),
    };
    this.sendToPeer(peerId, response);
  }

  private handleDelta(peerId: string, message: SyncMessage): void {
    if (!message.delta) return;

    for (const op of message.delta) {
      if (op.type === 'delete') {
        this.storage.deleteDocument(op.documentId);
      } else if (op.type === 'set') {
        const existing = this.storage.getDocument(op.documentId);
        const newDoc: CRDTDocument = {
          id: op.documentId, type: 'register', data: op.value,
          vectorClock: op.vectorClock, timestamp: Date.now(),
        };
        if (existing) {
          this.storage.storeDocument(this.conflictService.resolve(existing, newDoc));
        } else {
          this.storage.storeDocument(newDoc);
        }
      }
    }

    this.broadcastDelta(peerId, message.delta);
  }

  private broadcastDelta(excludePeerId: string, delta: any[]): void {
    const message: SyncMessage = { type: 'delta', peerId: 'server', delta };
    for (const [peerId, ws] of this.peers) {
      if (peerId !== excludePeerId) ws.send(JSON.stringify(message));
    }
  }

  private sendFullSync(peerId: string): void {
    const message: SyncMessage = {
      type: 'sync',
      peerId: 'server',
      documents: this.storage.getAllDocuments(),
      tombstones: this.storage.getTombstones(),  // ← CRITICAL
      vectorClock: this.storage.getGlobalVectorClock(),
    };
    this.sendToPeer(peerId, message);
  }

  private sendToPeer(peerId: string, message: SyncMessage): void {
    const ws = this.peers.get(peerId);
    if (ws) ws.send(JSON.stringify(message));
  }
}
```

## Step 6: Testing

Create `tests/sync.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../src/services/StorageService.js';
import { SyncService } from '../src/services/SyncService.js';
import { ConflictResolutionService } from '../src/services/ConflictResolutionService.js';

describe('SyncService', () => {
  let storage: StorageService;
  let conflictService: ConflictResolutionService;
  let syncService: SyncService;

  beforeEach(() => {
    storage = new StorageService();
    conflictService = new ConflictResolutionService();
    syncService = new SyncService(storage, conflictService);
  });

  it('should include tombstones in sync responses', () => {
    storage.storeDocument({ id: 'doc-1', type: 'register', data: { title: 'Hello' }, vectorClock: { peer1: 1 }, timestamp: Date.now() });
    storage.deleteDocument('doc-1');

    const ws2 = { send: vi.fn() } as any;
    syncService.connectPeer('peer-2', ws2);

    const response = JSON.parse(ws2.send.mock.calls[0][0]);
    expect(response.documents).toHaveLength(0);
    expect(response.tombstones).toBeDefined();
    expect(response.tombstones).toHaveLength(1);
    expect(response.tombstones[0].documentId).toBe('doc-1');
  });
});
```

## Step 7: Run

```bash
npx vitest
```
