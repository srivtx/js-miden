# Architecture

## System Architecture

The DataSync engine consists of four services working together to provide real-time, offline-first synchronization.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WebSocket Server (Sync Service)                  │
│  Handles: connect, disconnect, sync, delta, presence                │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Sync       │    │    Conflict   │    │   Presence    │
│   Service     │    │  Resolution   │    │   Service     │
│               │    │   Service     │    │               │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Storage Service                               │
│  Documents: Map<string, CRDTDocument>                                │
│  Tombstones: Map<string, TombstoneEntry>  (BUG: Not used in sync)   │
│  Global Vector Clock: Merged from all documents                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Sync Protocol

### Initial Sync (New Peer)
```
Client connects ──► Server sends all documents + global vector clock
                   Client sends local documents (if any)
                   Server resolves conflicts
                   Client applies merged state
```

### Delta Sync (Ongoing)
```
Client edits ──► Generate delta operation
               Update local vector clock
               Send delta to server
               Server validates and broadcasts to other peers
               Other peers apply delta
```

### Reconnection Sync
```
Client reconnects ──► Send local vector clock
                    Server computes missing deltas
                    Send only changed documents/deltas
                    Client applies deltas
```

## Data Structures

### CRDT Document
```typescript
interface CRDTDocument {
  id: string;
  type: 'register' | 'map' | 'list';
  data: unknown;
  vectorClock: { [peerId: string]: number };
  timestamp: number;
  tombstone?: boolean;  // BUG: Not propagated in sync
}
```

### Tombstone Entry
```typescript
interface TombstoneEntry {
  documentId: string;
  deletedAt: number;
  vectorClock: VectorClock;
}
```

### Delta Operation
```typescript
interface DeltaOperation {
  type: 'set' | 'delete' | 'merge';
  documentId: string;
  path: string;
  value?: unknown;
  vectorClock: VectorClock;
}
```

## Offline-First Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Online  │───►│  Edit   │───►│  Sync   │
└─────────┘    └─────────┘    └─────────┘

┌─────────┐    ┌─────────┐    ┌─────────┐
│ Offline │───►│  Edit   │───►│ Queue   │
└─────────┘    └─────────┘    └─────────┘
                                  │
                                  ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Online  │◄───│  Sync   │◄───│ Apply   │
│ Again   │    │ Queue   │    │ Queue   │
└─────────┘    └─────────┘    └─────────┘
```

## References

[1] "A Comprehensive Study of CRDTs," Baquero et al., 2017.
[2] "Designing Data-Intensive Applications," Martin Kleppmann, Chapter 9.
[3] "Automerge: A JSON-like data structure for building collaborative applications."