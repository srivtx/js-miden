# E03 Data Sync: Architecture Decisions

## Decision 1: Operation-Based CRDTs with Vector Clocks

**Chosen**: Peers send delta operations (`set`, `delete`) with vector clocks. The server broadcasts to other peers.

**Alternatives Considered**:
- **State-based CRDTs**: Send full document state on every change. Pro: simple, no delivery requirements. Con: O(n) bandwidth per change.
- **Delta-state CRDTs**: Send a compressed delta derived from state. Pro: efficient, no causal delivery requirement. Con: complex to implement correctly.
- **OT (Operational Transformation)**: Transform operations against each other at a central server. Pro: intuitive results (Google Docs). Con: requires central server, transformation functions are error-prone.
- **Event Sourcing**: Store all events, replay to derive state. Pro: audit trail, replayability. Con: event log grows forever, snapshot management needed.

**Rationale**: Operation-based is the standard for real-time collaboration (Yjs, Automerge). Vector clocks provide causality tracking without central timestamps.

## Decision 2: WebSocket for Real-Time Sync

**Chosen**: The code structure implies WebSocket usage (connectPeer, handleMessage).

**Alternatives Considered**:
- **HTTP polling**: Simple, works everywhere. Con: high latency, wasted bandwidth.
- **Server-Sent Events (SSE)**: One-way server-to-client push. Con: can't handle client-to-server updates well.
- **WebRTC (P2P)**: Direct peer-to-peer connections. Pro: no server bandwidth cost. Con: complex NAT traversal, no offline peer storage.
- **MQTT**: Pub/sub protocol for IoT. Pro: lightweight. Con: not designed for CRDT semantics.

**Rationale**: WebSockets provide bidirectional, low-latency communication ideal for real-time sync.

## Decision 3: LWW (Last-Write-Wins) for Register Conflicts

**Chosen**: When two peers concurrently update the same register, keep the one with the higher timestamp.

**Alternatives Considered**:
- **Multi-value register**: Keep both values, let the application decide. Pro: no data loss. Con: applications must handle sets of values.
- **LWW-element-set**: Track additions and deletions with timestamps. Pro: handles add/remove conflicts. Con: tombstone accumulation.
- **PN-counter**: For numeric values, track positive and negative increments separately. Pro: correct for counters. Con: not general-purpose.
- **Woot / RGA (Replicated Growable Array)**: For ordered lists. Pro: correct text collaboration. Con: complex, list-specific.

**Rationale**: LWW is simple and sufficient for simple registers. For text, Yjs uses RGA. For maps, LWW-element-set is better.

## Decision 4: Tombstones Stored But Not Propagated

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: Tombstones must be included in every sync response. When a peer connects, send both active documents AND tombstones.

**Why the original skipped it**: The developer implemented `deleteDocument` to store a tombstone locally, but forgot to add tombstones to the sync message format. This is a classic "half-implemented feature" bug.
