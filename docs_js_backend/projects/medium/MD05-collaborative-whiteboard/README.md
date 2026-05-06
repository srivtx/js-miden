# MD05: Collaborative Whiteboard

A real-time collaborative drawing application supporting multiple users on the same canvas with cursor tracking, last-write-wins conflict resolution, and session replay.

## Features

- **Real-time Drawing**: Multiple users draw simultaneously on shared canvas
- **Cursor Tracking**: See other users' cursors in real-time with colors
- **Conflict Resolution**: Last-write-wins for stroke ordering
- **Session Replay**: Replay entire drawing sessions
- **Room Management**: Create/join rooms with role-based access
- **Persistence**: All strokes and sessions persisted to PostgreSQL

## Thinking Framework

### PHASE 1: Core Implementation

1. **WebSocket Connection**:
   - Client connects with JWT token
   - Server authenticates and joins user to requested room
   - Connection tracked in Redis for presence

2. **Drawing Protocol**:
   - Client sends `stroke:start`, `stroke:point`, `stroke:end` events
   - Server assigns monotonic sequence number for ordering
   - Broadcasts to all room members except sender
   - Persists stroke to database asynchronously

3. **Cursor Tracking**:
   - Client sends cursor position at 50ms throttled intervals
   - Server broadcasts to room with user color
   - Redis stores latest positions for new joiners

4. **Last-Write-Wins Resolution**:
   - Each stroke has server-assigned `sequence` number (BigInt)
   - On conflict, highest sequence wins
   - Client applies strokes in sequence order
   - Eraser strokes simply delete by stroke ID

5. **Session Replay**:
   - Recording starts when first user joins room
   - All stroke events serialized with timestamps
   - Replay endpoint returns events in chronological order
   - Client replays at configurable speed

### PHASE 2: Architecture Decisions

**WebSockets vs SSE**:
- WebSockets chosen for bidirectional low-latency communication
- SSE would work for broadcast but not for cursor tracking (too many events)
- ws library with per-room broadcast groups

**Conflict Resolution**:
- LWW chosen for simplicity over OT/CRDT
- OT/CRDT overkill for simple stroke-based drawing
- Sequence numbers assigned by server (single source of truth)
- If two users draw overlapping, last stroke visible on top

**Room State**:
- Active strokes cached in Redis for fast retrieval
- Persisted to PostgreSQL for durability
- New joiners get full room state from DB + recent Redis cache
- Redis pub/sub for multi-server deployments

### PHASE 3: Advanced Considerations

- **Operational Transform**: For text annotations, use OT instead of LWW
- **CRDTs**: For true peer-to-peer collaborative editing
- **Binary Protocol**: Use MessagePack instead of JSON for efficiency
- **Spatial Indexing**: R-tree for fast hit-testing on large canvases
- **Undo/Redo**: Stack-based undo per user with global sequence
- **Offline Support**: Queue strokes locally, sync on reconnect

## Tech Stack

- Express 5 with TypeScript (ESM)
- WebSocket server (ws library)
- Prisma ORM with PostgreSQL
- Redis for presence and room state cache
- JWT authentication

## Bug Introduction

### Bug 1: No Conflict Resolution
**Location**: `src/services/whiteboardService.ts` - `addStroke` function
**Issue**: Sequence number is assigned from client timestamp instead of server monotonic counter. Two strokes with same sequence can overwrite each other unpredictably.
**Impact**: Concurrent strokes from different users may be lost or appear in wrong order.

### Bug 2: Broadcast to Wrong Room
**Location**: `src/services/roomService.ts` - `broadcastToRoom` function
**Issue**: Missing room filter when iterating WebSocket connections. Message goes to ALL connected clients, not just room members.
**Impact**: Massive privacy leak - users see drawings from rooms they are not in.

### Bug 3: No Persistence on Server Restart
**Location**: `src/services/roomService.ts` - room state management
**Issue**: Room stroke state stored only in memory (Map). On server restart, all active room state is lost even though DB has historical strokes.
**Impact**: Users joining after restart see empty canvas until new strokes are drawn.

## Running the Project

```bash
# Start dependencies
docker-compose up -d

# Copy env and install
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate

# Run with bugs
npm run dev

# Run tests
npm test
```

## WebSocket Protocol

### Client → Server
- `join:room` `{ roomId }` - Join a room
- `stroke:start` `{ strokeId, type, color, width }` - Start drawing
- `stroke:point` `{ strokeId, x, y }` - Add point to stroke
- `stroke:end` `{ strokeId }` - Finish stroke
- `cursor:move` `{ x, y }` - Update cursor position
- `room:history` `{ roomId }` - Request full room history

### Server → Client
- `user:joined` `{ userId, name, color }`
- `user:left` `{ userId }`
- `stroke:started` `{ strokeId, userId, type, color, width }`
- `stroke:point` `{ strokeId, x, y }`
- `stroke:ended` `{ strokeId, sequence }`
- `cursor:moved` `{ userId, x, y, color }`
- `room:state` `{ strokes[] }` - Full room state on join

## API Endpoints

- `POST /api/rooms` - Create room
- `GET /api/rooms` - List rooms
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms/:id/join` - Join room (HTTP, returns WS token)
- `GET /api/rooms/:id/replay` - Get session replay data
- `GET /api/rooms/:id/strokes` - Get all strokes

## Project Structure

```
src/
├── index.ts              # Entry point + WS server
├── config/               # Configuration
├── routes/
│   ├── auth.ts          # Authentication routes
│   └── rooms.ts         # Room management routes
├── middleware/
│   ├── auth.ts          # JWT auth middleware
│   └── errorHandler.ts  # Global error handler
├── services/
│   ├── roomService.ts   # Room + broadcast logic
│   ├── whiteboardService.ts # Stroke management
│   └── replayService.ts # Session replay
├── utils/
│   └── wsHandler.ts     # WebSocket message router
└── types/
    └── index.ts         # TypeScript types + WS events
```
