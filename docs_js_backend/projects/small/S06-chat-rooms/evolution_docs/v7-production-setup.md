# v7 — Production Setup (Chat Rooms)

## The Scenario

It's 2am. Your junior deploys the chat app. "WebSockets work!" they say. Then user A sends a message in `room-a`. User B, in `room-b`, sees it. "Why am I getting messages from a room I'm not in?" User B asks. Your junior checks the code: `io.emit('message', msg)` broadcasts to **everyone**. The broadcast bug ships to production.

## The PAIN: Scope Is Everything in Real-Time

From v6:

```typescript
socket.on('message', (data: { room: string; text: string }) => {
  // BUG: Broadcasts to ALL connected clients instead of just the room
  io.emit('message', {
    room: data.room,
    text: data.text,
    sender: socket.id,
  });
});
```

### What breaks:

1. **Privacy leak**: Room messages leak to non-members
2. **Noise**: Users in quiet rooms get flooded by active rooms
3. **Scalability**: Broadcasting to 10,000 users for a 5-person room wastes bandwidth
4. **No persistence**: Messages exist only in transit. Refresh the page? History gone.

## The Solution: WebSocket Rooms + Proper Scoping

### 1. Server Setup (Express + Socket.IO)

```typescript
// src/index.ts (actual production code)
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { setupSockets } from './socket.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(join(__dirname, '../public')));

const httpServer = createServer(app);
const io = new Server(httpServer);

setupSockets(io);

const PORT = process.env.PORT || 3000;
export const server = httpServer.listen(PORT, () => {
  console.log(`S06 Chat Rooms listening on ${PORT}`);
});

export { app, io };
```

### 2. Socket Logic with Rooms

```typescript
// src/socket.ts (actual production code)
import type { Server, Socket } from 'socket.io';

const rooms = new Map<string, Set<string>>();

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('join', (room: string) => {
      socket.join(room);
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room)!.add(socket.id);

      // Notify room of join
      socket.to(room).emit('notification', { text: `${socket.id} joined ${room}` });
      socket.emit('joined', room);
    });

    socket.on('message', (data: { room: string; text: string }) => {
      // BUG: Broadcasts to ALL connected clients instead of just the room
      io.emit('message', {
        room: data.room,
        text: data.text,
        sender: socket.id,
      });
      
      // CORRECT (when fixed):
      // io.to(data.room).emit('message', {
      //   room: data.room,
      //   text: data.text,
      //   sender: socket.id,
      // });
    });

    socket.on('leave', (room: string) => {
      socket.leave(room);
      rooms.get(room)?.delete(socket.id);
      socket.to(room).emit('notification', { text: `${socket.id} left ${room}` });
    });

    socket.on('disconnect', () => {
      for (const [room, users] of rooms) {
        if (users.has(socket.id)) {
          users.delete(socket.id);
          socket.to(room).emit('notification', { text: `${socket.id} disconnected` });
        }
      }
    });
  });
}
```

### 3. The Evolution of Real-Time Architecture

| Version | Transport | Scope | Persistence |
|---------|-----------|-------|-------------|
| v1 | HTTP polling | Global | None |
| v2-3 | HTTP polling + types | Global | None |
| v4-5 | SSE or WebSocket | Global | None |
| v6 | Socket.IO | Attempted rooms | None |
| v7 | Socket.IO rooms | **BUG: global broadcast** | In-memory only |

The next evolution (beyond this project):
- Fix: `io.to(room).emit()` instead of `io.emit()`
- Persistence: Store messages in Redis/PostgreSQL
- History: `socket.emit('history', await getRoomHistory(room))` on join
- Presence: Track who's online per room

### 4. The Broadcast Bug (Intentionally Documented)

```typescript
// BUG: io.emit broadcasts to every connected socket
// FIX: io.to(data.room).emit broadcasts to room members only
```

The test documents it:
```typescript
it('BUG: leaks messages across rooms because io.emit broadcasts globally', async () => {
  client1.emit('join', 'room-a');
  client2.emit('join', 'room-b');
  
  const promise = waitFor(client2, 'message');
  client1.emit('message', { room: 'room-a', text: 'secret' });
  const msg: any = await promise;
  
  // client2 in room-b should NOT receive this, but does due to the bug
  expect(msg.text).toBe('secret');
});
```

### 5. Client (Static HTML)

```html
<!-- public/index.html -->
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io();
  
  socket.on('message', (data) => log(`[${data.room}] ${data.sender}: ${data.text}`));
  socket.on('notification', (data) => log(`* ${data.text}`));
  socket.on('joined', (room) => log(`Joined ${room}`));
  
  function join() { socket.emit('join', document.getElementById('room').value); }
  function leave() { socket.emit('leave', document.getElementById('room').value); }
  function send() {
    const room = document.getElementById('room').value;
    const text = document.getElementById('msg').value;
    socket.emit('message', { room, text });
  }
</script>
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Transport | HTTP polling | WebSocket (Socket.IO) |
| Rooms | None | Implemented (but broadcast bug) |
| Validation | None | Zod schemas |
| Scope | Global | Attempted room-scoped |
| Persistence | None | In-memory only |
| Types | None | TypeScript |
| Tests | None | Vitest (documents broadcast bug) |
| Module system | CommonJS | ESM |

## The Realization

> Junior: "I fixed the broadcast bug by changing `io.emit` to `io.to(room).emit`. The room isolation test passed. But then the 'sender sees own message' test failed because `socket.to` excludes the sender. The correct fix is `io.to(room).emit`. Three methods, three behaviors."
> 
> You: "Real-time scope is the hardest concept in WebSocket programming. `socket.emit` = sender only. `socket.to(room).emit` = room except sender. `io.to(room).emit` = room including sender. One wrong choice and messages disappear or leak. Always test with multiple clients in multiple rooms."

## Files in this project

```
S06-chat-rooms/
├── src/
│   ├── index.ts          # Express + HTTP server + Socket.IO
│   └── socket.ts         # Room logic (BUG: global broadcast)
├── public/
│   └── index.html        # Chat client
├── tests/
│   └── chat.test.ts      # Vitest (documents broadcast bug)
├── package.json          # ESM
└── tsconfig.json
```

## What You Learned

1. **Transport evolution**: Polling → SSE → WebSocket. Each step reduces latency and server load.
2. **Rooms are essential**: Without rooms, all users share one global namespace. Unscalable and insecure.
3. **Broadcast scope matters**: `io.emit` ≠ `socket.to.emit` ≠ `io.to.emit`. Know the difference.
4. **State management**: Room membership must be tracked server-side. Socket.IO's internal rooms + your own `Map` for metadata.
5. **Persistence is the next evolution**: In-memory rooms vanish on restart. Real chat needs Redis/DB for history and presence.

## The Final Lesson

> Junior: "We went from polling every second to WebSocket rooms. But the broadcast bug proves that even the 'right' technology can be used wrong."
> 
> You: "Exactly. Technology doesn't solve problems — correct usage does. Every layer we added had a pain that justified it. Array → file → SQLite → PostgreSQL. No validation → regex → Zod. Polling → SSE → WebSocket. The evolution never stops. Production is just the current snapshot of an ongoing journey."
