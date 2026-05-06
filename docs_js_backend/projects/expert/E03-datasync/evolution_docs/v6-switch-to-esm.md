# v6 — Switch to ESM

Your sync engine has tests, but CommonJS is fighting the WebSocket and CRDT libraries. Many modern CRDT libraries (Yjs, Automerge) are ESM-only. You're stuck on old versions or using dynamic `import()` hacks.

## Pain #1: ESM-Only Dependencies

```javascript
// CommonJS
const Y = require('yjs'); // Error: Yjs is ESM-only
// You have to do:
const Y = await import('yjs'); // Dynamic import
// But now Y is a Promise. Every usage is async.
```

You want to use Yjs for production-ready CRDTs. But your CommonJS codebase can't import it synchronously. You're stuck with a hand-rolled CRDT implementation.

## Pain #2: WebSocket Module Inconsistency

```javascript
// CommonJS
const WebSocket = require('ws');
// ws v8+ is ESM-first. require() returns different shapes in different versions.
```

Your sync service works with ws v7 but breaks on ws v8. The `WebSocket.Server` constructor changes. ESM would give you the stable import.

## Pain #3: Shared Type Imports

```javascript
// CommonJS
const { VectorClock } = require('../types');
// But VectorClock is a TypeScript interface.
// It doesn't exist at runtime. This throws.
```

In ESM, you import types with `import type`:
```typescript
import type { VectorClock } from '../types/index.js';
```

The `type` keyword ensures the import is erased at runtime. No errors.

## The Fix: ESM Migration

### package.json

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "start": "node dist/index.js"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Source Files

```typescript
// src/services/SyncService.ts
import { CRDTDocument, SyncMessage, VectorClock } from '../types/index.js';
import { StorageService } from './StorageService.js';
import { ConflictResolutionService } from './ConflictResolutionService.js';
import { logInfo, logError } from '../utils/logger.js';

export class SyncService {
  private peers: Map<string, WebSocket> = new Map();
  private documentVersions: Map<string, VectorClock> = new Map();

  constructor(
    private storage: StorageService,
    private conflictService: ConflictResolutionService
  ) {}

  connectPeer(peerId: string, ws: WebSocket): void {
    this.peers.set(peerId, ws);
    logInfo('Peer connected', { peerId });
    this.sendFullSync(peerId);
  }
  // ...
}
```

```typescript
// src/index.ts
import { WebSocketServer } from 'ws';
import { SyncService } from './services/SyncService.js';
import { StorageService } from './services/StorageService.js';
import { ConflictResolutionService } from './services/ConflictResolutionService.js';
import { logger } from './utils/logger.js';

const wss = new WebSocketServer({ port: 8080 });
const storage = new StorageService();
const conflictService = new ConflictResolutionService();
const syncService = new SyncService(storage, conflictService);

wss.on('connection', (ws, req) => {
  const peerId = new URL(req.url!, 'http://localhost').searchParams.get('peer') || crypto.randomUUID();
  syncService.connectPeer(peerId, ws);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      syncService.handleMessage(peerId, message);
    } catch (error) {
      logger.error({ peerId, error }, 'Invalid message');
    }
  });
  
  ws.on('close', () => {
    syncService.disconnectPeer(peerId);
  });
});

logger.info('DataSync server listening on port 8080');
```

## What Changed

1. **Modern CRDT libraries** — Yjs, Automerge, and others import cleanly.
2. **WebSocket stability** — `ws` imports are consistent across versions.
3. **Type safety** — `import type` prevents runtime errors from interface imports.
4. **Clean architecture** — Services are pure classes with explicit dependencies.

## ESM for Real-Time Systems

In a WebSocket-based sync engine, ESM reduces module friction. Every peer connection, every delta message, every CRDT merge depends on stable imports. ESM provides that stability.

## Next Pain

The server runs but has no graceful shutdown. Active WebSocket connections are dropped without sync completion. Peers lose deltas. You need production setup.
