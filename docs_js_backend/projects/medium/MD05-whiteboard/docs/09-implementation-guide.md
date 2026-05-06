# Implementation Guide

## Project Structure

```
MD05-whiteboard/
├── src/
│   ├── index.ts              # Express + WS server
│   ├── utils/
│   │   └── wsHandler.ts      # WebSocket routing, heartbeat
│   ├── services/
│   │   ├── whiteboardService.ts  # CRDT/OT state, merge
│   │   └── roomService.ts    # Room lifecycle, snapshots
│   ├── routes/
│   │   ├── auth.ts           # JWT login
│   │   └── rooms.ts          # HTTP room CRUD
│   └── middleware/
│       ├── auth.ts           # JWT verification
│       └── errorHandler.ts
├── tests/
│   └── whiteboard.test.ts    # CRDT convergence tests
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docs/                     # ← Documentation (this folder)
├── docker-compose.yml        # Postgres + Redis
├── package.json
└── vitest.config.ts
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Create account |
| `POST` | `/auth/login` | No | Get JWT |
| `POST` | `/rooms` | Yes | Create a whiteboard room |
| `GET` | `/rooms/:id` | Yes | Get room metadata |
| `GET` | `/rooms/:id/replay` | Yes | Replay to a timestamp |
| `WS` | `/ws` | Yes (JWT in `join`) | Real-time collaboration |

## WebSocket Message Types

| Direction | Type | Payload | Description |
|---|---|---|---|
| C→S | `join` | `{ roomId, authToken }` | Join a room |
| C→S | `op` | `{ roomId, payload }` | Send an operation |
| C→S | `cursor` | `{ roomId, x, y }` | Update cursor |
| C→S | `ping` | `{}` | Heartbeat |
| S→C | `joined` | `{ roomId, snapshot }` | Room state on join |
| S→C | `op` | `{ roomId, op, userId }` | Broadcast operation |
| S→C | `presence` | `{ roomId, users }` | User list update |
| S→C | `error` | `{ code, message }` | Error |
| S→C | `pong` | `{}` | Heartbeat response |

## Running the Project

```bash
# Start dependencies
docker-compose up -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Run tests
npm test

# Start server
npm run dev
```

## Environment Variables

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/whiteboard?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="super-secret-change-in-production"
```

## Testing Checklist

- [ ] Two clients type simultaneously; text converges correctly
- [ ] One client disconnects and reconnects; receives missed ops
- [ ] Server restart; room state recovered from snapshot
- [ ] 100 simulated clients; p99 latency < 100 ms
- [ ] Session replay reconstructs exact state at any timestamp
- [ ] Cursor updates throttled to < 30 messages/sec per user
- [ ] Unauthorized user cannot join room

## Performance Checklist

- [ ] Use msgpack or binary JSON for WebSocket messages
- [ ] Room state unloaded after 5 min inactivity
- [ ] Snapshots taken every 60 seconds
- [ ] Redis pub/sub for cross-server broadcast
- [ ] Heartbeat timeout terminates dead connections

## References

- Yjs: https://docs.yjs.dev/
- Automerge: https://automerge.org/
- "CRDTs and the Quest for Distributed Consistency" — Martin Kleppmann
