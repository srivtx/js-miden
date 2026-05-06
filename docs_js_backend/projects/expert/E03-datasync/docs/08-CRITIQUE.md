# E03 Data Sync: Critique

## What This Project Does Well

1. **Demonstrates a subtle distributed systems bug**: Tombstone omission is not obvious. Many developers implement "delete" as `map.delete(key)` and never think about sync consequences.
2. **Teaches vector clocks**: The `compareVectorClocks` function is a clean implementation of a core distributed systems concept.
3. **Shows operation-based CRDTs**: The delta sync pattern is efficient and realistic.

## What This Project Gets Wrong

### 1. No Real WebSocket Implementation
The `SyncService` accepts `WebSocket` objects but the project doesn't include a WebSocket server setup. The tests mock WebSocket with `{ send: vi.fn() }`.

**Better**: Include a `ws` server in `src/index.ts` that wires up the `SyncService`.

### 2. No Persistence
All state is in-memory. If the server restarts, all documents and tombstones are lost.

**Better**: Store documents and tombstones in PostgreSQL or Redis. On startup, load state from disk.

### 3. No Client Library
This is a server-only project. A real data sync system needs a client library that:
- Maintains local state
- Buffers edits when offline
- Reconnects and syncs automatically
- Handles WebSocket disconnections gracefully

**Better**: Create a companion `SyncClient` class that runs in the browser.

### 4. No Delta State CRDT
Operation-based CRDTs require causal broadcast delivery. If a peer receives operation B before operation A (and B depends on A), the state is inconsistent.

The project does not handle this. A delta-state CRDT or a reliable broadcast layer would solve it.

### 5. No Tombstone Garbage Collection
Tombstones accumulate forever. In a long-running system with millions of deleted documents, memory usage grows unbounded.

**Better**: Implement a GC algorithm. After all known peers have acknowledged a clock value greater than the tombstone's clock, the tombstone can be removed.

### 6. No E2E Encryption
The server can read all documents. In a privacy-sensitive application (notes, health data), the server should only see encrypted blobs.

**Better**: Use a symmetric key shared among peers (via a separate key exchange) to encrypt document data before sending it to the server.

### 7. No Presence Awareness
The `PresenceInfo` type exists but is never used. Real collaborative apps show:
- Who is currently editing
- Where their cursor is
- What they are selecting

### 8. No Undo/Redo
CRDTs naturally support undo because every operation is recorded. But this project has no undo mechanism.

### 9. Simplified Conflict Resolution
LWW on timestamps is primitive. For text, Yjs uses RGA (Replicated Growable Array). For maps, Automerge uses multi-value registers. This project only handles single-value registers.

## What Would Make This Production-Ready

| Feature | Effort | Priority |
|---------|--------|----------|
| WebSocket server setup | 1 day | Critical |
| PostgreSQL persistence | 2 days | Critical |
| Client library (browser) | 3 days | Critical |
| Tombstone garbage collection | 2 days | High |
| E2E encryption | 3 days | Medium |
| Presence awareness | 2 days | Medium |
| Undo/redo | 2 days | Medium |
| RGA text CRDT | 5 days | Low |

## Final Verdict

This is a **distributed systems teaching tool**. It demonstrates why deletion is the hardest problem in sync and why vector clocks matter. It is not a replacement for Yjs, Automerge, or Loro.

**The real lesson**: In distributed systems, deletion is not the absence of data—it is data. A tombstone is a first-class citizen. Forget it, and your users will never trust your delete button again.
