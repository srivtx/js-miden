# Scaling WebSocket Infrastructure

## The Challenge
A single Node.js process can handle ~10,000 concurrent WebSocket connections. Beyond that, you need horizontal scaling.

## Horizontal Scaling with Redis

```
                    ┌─────────────┐
                    │   Load      │
                    │  Balancer   │
                    │  (sticky    │
                    │   session)  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  Server 1   │  │  Server 2   │  │  Server 3   │
    │  (WS)       │  │  (WS)       │  │  (WS)       │
    │  rooms A-D  │  │  rooms E-H  │  │  rooms I-L  │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                    ┌──────────────┐
                    │    Redis     │
                    │   Pub/Sub    │
                    │  (messages   │
                    │   cross-srv) │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (ops,       │
                    │   snapshots) │
                    └──────────────┘
```

**Sticky sessions** (via `ip_hash` or cookie) ensure a user reconnects to the same server. If a server dies, the client reconnects to a new one and replays missed ops.

## Sharding by Room

Instead of broadcasting all messages through Redis, **shard rooms** across servers:

```typescript
function getServerForRoom(roomId: string, serverCount: number): number {
  // Consistent hashing
  const hash = crypto.createHash('sha256').update(roomId).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % serverCount;
}
```

When a server receives an op for a room it does not own, it forwards it to the correct server via Redis or an internal RPC.

## Memory Optimization

| Technique | Savings |
|---|---|
| **Binary messages** (msgpack) | ~50% smaller than JSON |
| **Delta updates** | Send only changed properties, not full objects |
| **Lazy loading** | Load room state from DB only when first user joins |
| **Room TTL** | Unload room from memory after 5 minutes of inactivity |

```typescript
class RoomManager {
  private rooms = new Map<string, Room>();
  private timers = new Map<string, NodeJS.Timeout>();

  getOrCreate(roomId: string): Room {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId));
    }
    // Reset TTL
    clearTimeout(this.timers.get(roomId));
    this.timers.set(roomId, setTimeout(() => this.unload(roomId), 5 * 60 * 1000));
    return this.rooms.get(roomId)!;
  }

  private unload(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room && room.clientCount === 0) {
      room.saveSnapshot();
      this.rooms.delete(roomId);
    }
  }
}
```

## Backpressure & Flow Control

If a client is on a slow connection, do not buffer infinite messages:

```typescript
const MAX_BUFFERED = 100;

function send(ws: WebSocket, message: string) {
  if (ws.bufferedAmount > MAX_BUFFERED * message.length) {
    // Client is too slow; drop non-critical messages (e.g., cursor updates)
    // or close the connection
    console.warn('Backpressure detected; dropping message');
    return;
  }
  ws.send(message);
}
```

## Monitoring

| Metric | Alert Threshold |
|---|---|
| Connections per server | > 8,000 |
| Message latency (p99) | > 100 ms |
| Redis pub/sub lag | > 50 ms |
| Room memory usage | > 50 MB |
| Reconnection rate | > 10% of users in 1 min |

## Testing at Scale

Use load testing tools:
- **Artillery**: `artillery quick --count 10000 --num 100 ws://localhost:3000`
- **k6**: JavaScript-based load testing with WebSocket support
- **Custom**: Spawn `ws` clients in Node.js clusters

```typescript
// k6 load test example
import ws from 'k6/ws';
import { check } from 'k6';

export default function () {
  const url = 'ws://localhost:3000';
  const res = ws.connect(url, null, (socket) => {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'join', roomId: 'test-room' }));
    });
    socket.on('message', (msg) => {
      check(msg, { 'received message': (m) => m.length > 0 });
    });
    socket.setTimeout(() => socket.close(), 30000);
  });
  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
```

## References

- "Scaling WebSockets" — Aleksandar Lazic, InfoQ
- "High-Performance Browser Networking" — Ilya Grigorik (WebSocket chapter)
