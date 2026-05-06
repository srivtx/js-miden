# v7 — Production Setup

Your sync engine works locally. But production sync has unique challenges: WebSocket connection limits, tombstone growth, encryption at rest, and compliance. A restart can't lose in-flight deltas.

## Pain #1: WebSocket Connection Limits

```typescript
// src/index.ts
const wss = new WebSocketServer({ port: 8080 });
// No connection limits. 100,000 peers crash the server.
// No heartbeat. Dead connections accumulate.
// Memory grows unbounded.
```

A popular document gets 50,000 concurrent editors. The server runs out of file descriptors. New connections are rejected.

## Pain #2: Tombstone Growth

```typescript
// StorageService.ts
private tombstones: Map<string, TombstoneEntry> = new Map();
// Tombstones are never removed. After 1 year, 10M tombstones.
// Memory usage grows linearly.
// Sync responses include all tombstones. Bandwidth explodes.
```

Documents are created and deleted constantly. Tombstones accumulate forever. Sync messages grow from 1KB to 50MB.

## Pain #3: No Encryption

```typescript
// WebSocket sends raw JSON
ws.send(JSON.stringify({ type: 'delta', documentId: 'doc-1', data: 'sensitive' }));
// Anyone on the network can intercept.
// No encryption at rest either.
```

Medical records, financial data, and legal documents are synced in plaintext. A network tap exposes everything.

## Pain #4: No Persistence

```typescript
// Documents live in memory
private documents: Map<string, CRDTDocument> = new Map();
// Server restart = all data lost.
// Peers must sync everything from scratch.
```

The server restarts for an update. All documents are gone. 10,000 peers reconnect and trigger a thundering herd. The server crashes again.

## The Fix: Production Sync Architecture

### Connection Management with Heartbeats

```typescript
// src/services/ConnectionManager.ts
import { logger } from '../utils/logger.js';

const MAX_CONNECTIONS = 10000;
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

export class ConnectionManager {
  private peers: Map<string, WebSocket> = new Map();
  private heartbeats: Map<string, number> = new Map();
  
  acceptConnection(peerId: string, ws: WebSocket): boolean {
    if (this.peers.size >= MAX_CONNECTIONS) {
      logger.warn('Connection limit reached');
      ws.close(1013, 'Server overloaded'); // Try Again Later
      return false;
    }
    
    this.peers.set(peerId, ws);
    this.heartbeats.set(peerId, Date.now());
    
    ws.on('pong', () => {
      this.heartbeats.set(peerId, Date.now());
    });
    
    return true;
  }
  
  startHeartbeatCheck() {
    setInterval(() => {
      const now = Date.now();
      for (const [peerId, lastHeartbeat] of this.heartbeats) {
        if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
          logger.warn({ peerId }, 'Peer heartbeat timeout');
          this.disconnectPeer(peerId);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }
  
  private disconnectPeer(peerId: string) {
    const ws = this.peers.get(peerId);
    if (ws) {
      ws.terminate();
      this.peers.delete(peerId);
      this.heartbeats.delete(peerId);
    }
  }
}
```

### Tombstone Garbage Collection

```typescript
// src/services/TombstoneGC.ts
import { logger } from '../utils/logger.js';

const GC_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily
const TOMBSTONE_RETENTION_DAYS = 30;

export class TombstoneGC {
  constructor(private storage: StorageService) {}
  
  start() {
    setInterval(() => this.collect(), GC_INTERVAL_MS);
  }
  
  private collect() {
    const cutoff = Date.now() - (TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const tombstones = this.storage.getTombstones();
    let collected = 0;
    
    for (const tombstone of tombstones) {
      // Only collect if all known peers have acknowledged
      const ackedByAll = this.storage.getAllPeerIds().every(peerId =>
        this.storage.hasAcknowledged(peerId, tombstone.documentId)
      );
      
      if (ackedByAll && tombstone.deletedAt < cutoff) {
        this.storage.removeTombstone(tombstone.documentId);
        collected++;
      }
    }
    
    logger.info({ collected, remaining: this.storage.getTombstoneCount() }, 'Tombstone GC complete');
  }
}
```

### Encryption at Rest and in Transit

```typescript
// src/services/EncryptionService.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = scryptSync(process.env.ENCRYPTION_PASSWORD!, 'salt', 32);

export function encryptDocument(doc: CRDTDocument): EncryptedDocument {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  
  const plaintext = JSON.stringify(doc);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return {
    id: doc.id,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

export function decryptDocument(enc: EncryptedDocument): CRDTDocument {
  const decipher = createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(enc.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(enc.authTag, 'base64'));
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.data, 'base64')),
    decipher.final(),
  ]);
  
  return JSON.parse(decrypted.toString('utf8'));
}
```

```typescript
// src/index.ts
import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';

const server = createServer({
  cert: readFileSync(process.env.SSL_CERT_PATH!),
  key: readFileSync(process.env.SSL_KEY_PATH!),
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  // All WebSocket traffic is now TLS-encrypted
});

server.listen(8443, () => {
  logger.info('Secure sync server on port 8443');
});
```

### Persistent Storage with PostgreSQL

```typescript
// src/services/PersistentStorage.ts
import { Pool } from 'pg';
import { encryptDocument, decryptDocument } from './EncryptionService.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

export async function persistDocument(doc: CRDTDocument): Promise<void> {
  const encrypted = encryptDocument(doc);
  
  await pool.query(
    `INSERT INTO documents (id, iv, auth_tag, data, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       iv = EXCLUDED.iv,
       auth_tag = EXCLUDED.auth_tag,
       data = EXCLUDED.data,
       updated_at = NOW()`,
    [encrypted.id, encrypted.iv, encrypted.authTag, encrypted.data]
  );
}

export async function loadDocument(id: string): Promise<CRDTDocument | null> {
  const result = await pool.query(
    'SELECT iv, auth_tag, data FROM documents WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) return null;
  
  return decryptDocument({
    id,
    iv: result.rows[0].iv,
    authTag: result.rows[0].auth_tag,
    data: result.rows[0].data,
  });
}
```

## What Changed

1. **Connection limits** — Max 10,000 peers with heartbeat monitoring.
2. **Tombstone GC** — Old tombstones are removed after 30 days + peer ack.
3. **Encryption** — AES-256-GCM at rest, TLS in transit.
4. **Persistence** — PostgreSQL with encrypted documents. Survives restarts.

## Production Checklist

- [ ] WebSocket connection limits
- [ ] Heartbeat/ping-pong for dead connection detection
- [ ] Tombstone garbage collection
- [ ] Encryption at rest (AES-256-GCM)
- [ ] TLS for WebSocket (wss://)
- [ ] Persistent document storage (PostgreSQL)
- [ ] Graceful shutdown with delta draining
- [ ] Rate limiting per peer
- [ ] Presence status persistence
- [ ] GDPR-compliant data deletion

## The Evolution

| Stage | State |
|-------|-------|
| v1 | In-memory broadcast relay |
| v2 | TypeScript types for CRDT primitives |
| v3 | Validation for sync messages and vector clocks |
| v4 | Structured logging for convergence debugging |
| v5 | Property-based tests for CRDT correctness |
| v6 | ESM for modern CRDT libraries |
| v7 | Production sync with encryption, persistence, and scale limits |

This is a production data sync engine. It handles CRDT convergence, tombstone propagation, offline-first editing, and encryption. It started as a WebSocket relay. Now it's a Figma-scale collaboration backend.
