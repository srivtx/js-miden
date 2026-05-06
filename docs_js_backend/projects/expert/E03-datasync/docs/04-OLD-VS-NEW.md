# E03 Data Sync: Old vs New (2015 vs 2025)

## 2015 Approach: Centralized, Polling, Lossy

### Architecture
```
┌─────────┐      ┌──────────────┐      ┌─────────┐
│ Device A│      │  Central DB  │      │ Device B│
│ (Client)│◄────►│  (MySQL)     │◄────►│ (Client)│
└─────────┘      └──────────────┘      └─────────┘
        ↑                              ↑
        └───────── Poll every 30s ─────┘
```

### Characteristics
- **Polling**: Clients check for updates every 30 seconds
- **Last-write-wins**: If two devices edit between polls, the last one wins
- **Central server**: Single point of failure, single point of control
- **No offline support**: If the server is down, the app doesn't work
- **No real-time**: 30-second latency minimum

### Code (2015 Style)
```javascript
// 2015: Polling, no conflict handling
setInterval(async () => {
  const serverState = await fetch('/api/state');
  if (serverState.timestamp > localState.timestamp) {
    localState = serverState; // Silent overwrite!
  }
}, 30000);
```

### Problems
1. Data loss on every concurrent edit
2. High latency
3. Battery drain from polling
4. No offline support
5. Server is a bottleneck

---

## 2025 Approach: Decentralized, CRDT-Based, Offline-First

### Architecture
```
┌─────────┐      ┌──────────────┐      ┌─────────┐
│ Device A│◄────►│  Sync Server │◄────►│ Device B│
│ (Yjs/   │ WS   │  (WebSocket) │ WS   │ (Yjs/   │
│  Automerge)│   │              │      │  Automerge)│
└─────────┘      └──────────────┘      └─────────┘
        ▲                              ▲
        └─────── CRDT merge ───────────┘
              (works offline too)
```

### Characteristics
- **CRDTs**: Yjs, Automerge, or Loro for data structures
- **WebSockets**: Real-time bidirectional sync
- **Offline-first**: Edit locally, sync when online
- **Conflict-free**: Concurrent edits merge automatically
- **Delta sync**: Only send changes, not full state
- **End-to-end encryption**: Optional encryption so the server can't read data

### Code (2025 Style)
```typescript
// 2025: Yjs or Automerge
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const doc = new Y.Doc();
const provider = new WebsocketProvider('wss://sync.example.com', 'room-1', doc);

const ytext = doc.getText('content');

// Local edit (works offline)
ytext.insert(0, 'Hello');

// Automatically synced when online
// Concurrent edits from other peers merge automatically
```

### Evolution Summary

| Aspect | 2015 | 2025 |
|--------|------|------|
| Sync model | Polling | WebSocket / WebRTC |
| Conflict handling | LWW (silent data loss) | CRDTs (automatic merge) |
| Offline support | None | Full offline-first |
| Data structure | JSON blobs | CRDT types (text, map, array) |
| Libraries | Custom | Yjs, Automerge, Loro |
| Encryption | TLS only | E2E encryption (optional) |
| Presence | None | Cursor positions, user awareness |

## What Changed Dramatically

- **Yjs (2019)**: Marcin Warpechowski created the most popular CRDT library. Used by Figma, Relm, and hundreds of startups.
- **Automerge (2018)**: Rust-based CRDT with excellent performance and binary format.
- **Loro (2023)**: Next-gen CRDT with time-travel, undo/redo, and fractional indexing.
- **Local-first software movement**: Apps that work offline by default, with sync as an enhancement.
- **CRDTs in databases**: Riak, AntidoteDB, and Redis CRDT modules bring CRDTs to backend storage.

## What Didn't Change

- **Eventual consistency is still eventual**: There is a window of inconsistency between edit and sync
- **CRDTs can't merge everything**: Some operations (e.g., "move file from A to B" and "delete A") have no perfect CRDT solution
- **Network partitions happen**: CRDTs handle them, but users may still see confusing intermediate states
