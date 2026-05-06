# S06 Chat Rooms — Performance

## Broadcast Efficiency

The current code contains a critical performance bug:
```typescript
// BUG: broadcasts to ALL connected clients globally
io.emit('message', { room: data.room, text: data.text, sender: socket.id });
```

In a server with 10,000 sockets and a room of 5 people, this sends 10,000 messages instead of 4. The fix:
```typescript
socket.to(data.room).emit('message', payload); // sends to room minus sender
```

Socket.io maintains room indexes internally, so `socket.to(room)` is O(1) to find the room and O(N) to emit to N members—far better than O(TotalSockets).

## Memory Usage of In-Memory Registry

```typescript
const rooms = new Map<string, Set<string>>();
```

For 10,000 sockets in 1,000 rooms:
- Each socket ID string: ~20 bytes + V8 overhead ≈ 64 bytes
- Each Set entry: ~8 bytes reference
- Total: ~72 KB per socket reference
- Room keys: negligible

At Discord scale (millions of concurrent rooms), this in-memory approach is impossible. They shard by guild and use Erlang/Elixir (BEAM VM) for lightweight processes.

## Horizontal Scaling

Socket.io is single-process by default. To scale:
1. **Sticky sessions**: Load balancers must route a client's WebSocket to the same Node.js process (or use IP hash).
2. **Redis Adapter**: `npm i @socket.io/redis-adapter`
   ```typescript
   import { createAdapter } from '@socket.io/redis-adapter';
   io.adapter(createAdapter(pubClient, subClient));
   ```
   This publishes messages to a Redis channel; all server nodes subscribe and forward to their local sockets.

## Connection Limits

| Environment | Approximate Max Concurrent WebSockets |
|-------------|---------------------------------------|
| Default Node.js (1 CPU) | ~10,000–20,000 |
| Node.js + `uws` engine | ~100,000+ |
| Nginx reverse proxy | ~50,000 (tune `worker_connections`) |
| Single EC2 c5.2xlarge | ~50,000–100,000 with `uws` |

For massive scale, prefer **partitioning** (many small Socket.io namespaces or microservices) over one giant process.

## Heartbeat & Idle Connections

Socket.io sends `ping/pong` frames every 25 seconds by default. Tuning this:
- **Lower interval** (e.g., 5s): Faster detection of dead connections, but higher bandwidth.
- **Higher interval** (e.g., 60s): Less bandwidth, slower ghost detection.

Mobile chat apps (WhatsApp) use a modified MQTT with keepalive of ~15 minutes to save battery, accepting slower detection of dead peers.
