# S06 Chat Rooms — Overview

## Project Goal
Build a lightweight real-time chat system supporting multiple rooms, user presence notifications, and broadcasted messages. The project demonstrates WebSocket-based bidirectional communication using Socket.io on top of an Express HTTP server.

## Key Features
- **Room-based messaging**: Users can join named rooms and receive messages scoped to that room.
- **Presence notifications**: Other room members are notified when a user joins, leaves, or disconnects.
- **Static client hosting**: The Express server hosts a simple HTML client from `public/`.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express (HTTP server)
- **Real-time layer**: Socket.io (WebSocket with fallbacks)
- **Language**: TypeScript

## High-Level Architecture

```
┌──────────────┐      HTTP       ┌──────────────┐
│   Browser    │ ─────────────── │   Express    │
│  (static)    │                 │   (app)      │
└──────────────┘                 └──────┬───────┘
                                        │
                              ┌─────────┴─────────┐
                              │   Socket.io       │
                              │   (ws upgrade)    │
                              └─────────┬─────────┘
                                        │
                              ┌─────────┴─────────┐
                              │   In-memory       │
                              │   room registry   │
                              └───────────────────┘
```

The server tracks room membership in a `Map<string, Set<string>>` where the key is the room name and the value is a set of connected socket IDs.

## Entry Points
- `src/index.ts` — Bootstraps Express, creates HTTP server, attaches Socket.io.
- `src/socket.ts` — Defines all event handlers (`join`, `message`, `leave`, `disconnect`).
- `public/index.html` — Minimal chat UI for manual testing.

## Scope & Limitations
This is an educational project. It intentionally omits:
- Persistent message history (no database)
- Authentication and user identity
- Rate limiting and spam prevention
- Horizontal scaling (rooms exist only in a single process)

These gaps are documented in `06-security.md` and `07-performance.md` with recommended mitigations.
