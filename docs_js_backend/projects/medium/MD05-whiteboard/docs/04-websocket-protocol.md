# WebSocket Protocol

## Why WebSockets?
HTTP polling introduces latency (200–500 ms per round trip). WebSockets provide **full-duplex**, **persistent** connections with sub-100 ms latency.

## Protocol Design

### Message Types

```typescript
type ClientMessage =
  | { type: 'join'; roomId: string; authToken: string }
  | { type: 'op'; roomId: string; payload: Operation }
  | { type: 'cursor'; roomId: string; x: number; y: number }
  | { type: 'ping' }
  | { type: 'leave'; roomId: string };

type ServerMessage =
  | { type: 'joined'; roomId: string; userId: string; snapshot: State }
  | { type: 'op'; roomId: string; op: Operation; userId: string }
  | { type: 'presence'; roomId: string; users: UserPresence[] }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };
```

### Connection Lifecycle

```
Client                              Server
  │                                   │
  │───── WS handshake ──────────────▶│
  │                                   │
  │◄──── Connection accepted ────────│
  │                                   │
  │───── {type: 'join', roomId} ────▶│
  │                                   │
  │◄──── {type: 'joined', snapshot} ─│
  │                                   │
  │───── {type: 'op', payload} ─────▶│
  │                                   │─▶ broadcast to room
  │◄──── {type: 'op', ...} ──────────│ (echo to sender + others)
  │                                   │
  │───── {type: 'ping'} ────────────▶│
  │◄──── {type: 'pong'} ─────────────│
  │                                   │
  │───── {type: 'leave'} ───────────▶│
  │◄──── WS close ───────────────────│
```

## Room State Management

Each room maintains:
1. **Document state** (the whiteboard objects)
2. **Operation log** (for replay and late-joiners)
3. **Connected clients** (WebSocket connections)

```typescript
class Room {
  id: string;
  state: WhiteboardState;        // current CRDT state
  ops: Operation[];              // all operations ever
  clients: Map<string, WebSocket>;
  snapshotInterval: NodeJS.Timeout;

  broadcast(op: Operation, excludeUserId?: string) {
    const msg = JSON.stringify({ type: 'op', roomId: this.id, op });
    for (const [userId, ws] of this.clients) {
      if (userId !== excludeUserId && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }
}
```

## Reconnection & Missed Operations

When a client reconnects, it sends its **last known operation vector clock** (or timestamp). The server replays all operations since then.

```
Client (reconnecting)
  │
  │───── {type: 'join', roomId, lastOpId: 'op_123'} ───▶ Server
  │
  │◄──── {type: 'replay', ops: [op_124, op_125, ...]} ──
  │
  │── applies ops locally ──▶ Converged state
```

## Scaling with Redis Pub/Sub

A single Node.js server cannot handle millions of concurrent rooms. Use **Redis** as a message bus between server instances.

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Server A   │◄───────►│   Redis     │◄───────►│  Server B   │
│  (rooms 1-  │   pub/  │   Pub/Sub   │   pub/  │  (rooms 500-│
│   500)      │   sub   │             │   sub   │   1000)     │
└─────────────┘         └─────────────┘         └─────────────┘

Server A receives an op for room 750:
  → Server A publishes to Redis channel "room:750"
  → Server B (which holds room 750 clients) receives it
  → Server B broadcasts to its local WebSockets
```

```typescript
import { createClient } from 'redis';

const pub = createClient({ url: process.env.REDIS_URL });
const sub = pub.duplicate();

async function broadcastToRoom(roomId: string, op: Operation) {
  await pub.publish(`room:${roomId}`, JSON.stringify(op));
}

sub.subscribe(`room:*`, (message, channel) => {
  const roomId = channel.split(':')[1];
  const op = JSON.parse(message);
  const room = rooms.get(roomId);
  if (room) room.broadcast(op);
});
```

## Heartbeat & Timeout

WebSocket connections can silently drop. Implement a **ping/pong** heartbeat:

```typescript
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10000;  // 10 seconds

function startHeartbeat(ws: WebSocket) {
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  const interval = setInterval(() => {
    if (!ws.isAlive) {
      ws.terminate();
      clearInterval(interval);
      return;
    }
    ws.isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);
}
```

## OWASP Security Considerations

- **Rate limiting**: Prevent a client from flooding ops (e.g., max 30 ops/sec)
- **Message size limit**: Reject payloads > 1 MB
- **Authentication**: Validate JWT in `join` message; reject unauthenticated
- **Authorization**: Ensure user is a member of the room before accepting ops
- **Input validation**: Validate operation structure; reject malformed JSON

> "WebSocket connections bypass many traditional HTTP security controls. Implement authentication, authorization, and rate limiting at the WebSocket layer." — OWASP WebSocket Security Cheat Sheet
