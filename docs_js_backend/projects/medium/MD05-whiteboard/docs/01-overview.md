# MD05 Whiteboard — Project Overview

## Goal
Build a real-time collaborative whiteboard where multiple users can draw, type, and move objects simultaneously, with conflict resolution, presence awareness, and session replay.

## Why This Matters
- Real-time collaboration is expected in modern SaaS (Figma, Miro, Google Docs)
- **Consistency** without locking is hard: two users editing the same object must converge to the same state
- **Latency** matters: operations must feel instantaneous, even across continents

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Client A  │◄────►│              │◄────►│   Client B      │
│  (Browser)  │  WS  │  WS Server   │  WS  │  (Browser)      │
└─────────────┘      │  (Node.js)   │      └─────────────────┘
                     │              │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Room State  │
                     │  (in-memory  │
                     │   + Redis)   │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  PostgreSQL  │
                     │  (snapshot   │
                     │   + history) │
                     └──────────────┘
```

## Core Modules
1. **WS Handler** (`src/utils/wsHandler.ts`) — WebSocket connection, message routing
2. **Whiteboard Service** (`src/services/whiteboardService.ts`) — CRDT/OT logic, state management
3. **Room Service** (`src/services/roomService.ts`) — room lifecycle, presence, snapshots

## Key Concepts
- **Operational Transform (OT)**: Transform operations so they can be applied in any order
- **CRDTs**: Commutative, associative, idempotent data structures that converge automatically
- **Presence**: Cursor positions, user names, selection highlights
- **Session Replay**: Reconstruct the whiteboard by replaying the operation log

## Tech Stack
- Node.js + Express + `ws` library
- Redis (pub/sub for multi-server scaling)
- PostgreSQL (operation log, snapshots)
- Vitest (testing)

## Comparison: OT vs CRDT

| Aspect | OT | CRDT |
|---|---|---|
| **Complexity** | High (requires central server to sequence) | Medium (each peer is independent) |
| **Convergence** | Guaranteed if central server correct | Guaranteed by mathematical properties |
| **Latency** | Requires server ack before local apply | Local apply instantly, sync later |
| **Conflict resolution** | Server transforms operations | Commutative operations eliminate conflicts |
| **Offline support** | Poor (needs server for transforms) | Excellent (works fully offline) |
| **Examples** | Google Docs (historically), CodeMirror 5 | Figma, Yjs, AutoMerge, CodeMirror 6 |

## Checklist
- [ ] Choose OT or CRDT based on product requirements
- [ ] Presence state is ephemeral (Redis) and recoverable (rejoin room)
- [ ] Session replay can reconstruct any point in time
- [ ] WebSocket reconnection restores missed operations
