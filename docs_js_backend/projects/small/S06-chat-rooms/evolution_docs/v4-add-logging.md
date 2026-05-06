# v4 — Add Logging (Chat Rooms)

## The Scenario

It's 2am. Users report "messages are disappearing." Your junior checks the server — it's running. They check the client — no errors. They ask: "Which messages?" The user: "The ones I sent to #general around 3pm." Your junior has no logs. No request IDs. No message history. Just a black box.

## The PAIN: Real-Time Is Invisible

From v3:

```typescript
socket.on('message', (data: { room: string; text: string }) => {
  const msg = {
    room: data.room,
    text: data.text,
    sender: socket.id,
    timestamp: Date.now(),
  };
  io.emit('message', msg); // Broadcasts to ALL
});
```

### What breaks in production:

1. **No message history**: Socket.IO broadcasts live. Nothing is persisted. "What did they say?" → We don't know.

2. **No connection tracking**: 500 active sockets. 5 disconnect mysteriously. Why? No logs.

3. **No room metrics**: Which rooms are active? How many users per room? You're guessing.

4. **No error visibility**: Socket event handlers throw. The error goes to console and vanishes.

5. **The broadcast bug**: `io.emit` sends to everyone, not just the room. Without logs, you don't know messages leak across rooms.

## The Solution: Structured Logging for Socket Events

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});
```

```typescript
// socket.ts
import { logger } from './logger.js';

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    const socketLogger = logger.child({ socketId: socket.id });
    socketLogger.info('Client connected');
    
    socket.on('join', (rawRoom: string) => {
      const parseResult = joinSchema.safeParse(rawRoom);
      if (!parseResult.success) {
        socketLogger.warn({ room: rawRoom }, 'Invalid room join attempt');
        socket.emit('error', { message: 'Invalid room name' });
        return;
      }
      const room = parseResult.data;
      
      socket.join(room);
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room)!.add(socket.id);
      
      socketLogger.info({ room, roomSize: rooms.get(room)!.size }, 'Client joined room');
      socket.to(room).emit('notification', { text: `${socket.id} joined ${room}` });
      socket.emit('joined', room);
    });
    
    socket.on('message', (rawData: unknown) => {
      const parseResult = messageSchema.safeParse(rawData);
      if (!parseResult.success) {
        socketLogger.warn({ issues: parseResult.error.issues }, 'Invalid message received');
        return;
      }
      
      const data = parseResult.data;
      const msg = {
        room: data.room,
        text: data.text,
        sender: socket.id,
        timestamp: Date.now(),
      };
      
      // BUG: This still broadcasts globally
      // But now we log it:
      socketLogger.info({ room: data.room, textLength: data.text.length, recipientCount: io.engine.clientsCount }, 'Broadcasting message');
      io.emit('message', msg);
    });
    
    socket.on('disconnect', () => {
      socketLogger.info('Client disconnected');
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

### What structured logging gives you:

| Need | console.log | Structured logger |
|------|------------|-------------------|
| Message history | ❌ None | ✓ Log stream (not persistent storage, but traceable) |
| Room metrics | ❌ Guess | ✓ Track joins/leaves per room |
| Connection drops | ❌ Silent | ✓ Disconnect reasons (if available) |
| Broadcast scope | ❌ Unknown | ✓ `recipientCount` reveals global vs room broadcast |
| Error tracing | ❌ Lost | ✓ Socket ID correlation |

## The PAIN of the Broadcast Bug

```typescript
// Without logging:
// User in room-a receives message from room-b
// You can't reproduce it
// You don't know it's happening to everyone

// With logging:
// `recipientCount: 500` for a room with 5 users
// Pattern: broadcasting to ALL instead of room
// Diagnosis: io.emit instead of io.to(room).emit
```

Logging turns invisible architectural bugs into visible metrics.

## Logging Evolution in Chat Rooms

| Version | Logging | Real-time observability |
|---------|---------|------------------------|
| v1 (JS) | None | Black box |
| v2 (TS) | console.log | Ephemeral |
| v3 (Validation) | console.log | Same problems |
| v4 (Structured) | JSON with socket/room metrics | Visible connections |

## The Realization

> Junior: "I logged `recipientCount` and saw it was always the total connection count, not the room size. That's how I found the broadcast bug."
> 
> You: "Socket.IO bugs are invisible. You can't `curl` a WebSocket. Logging is your only debugger in production. Log every join, every leave, every broadcast scope."

## The Next PAIN

Logging reveals the broadcast bug. But how do you prove the fix works? How do you ensure rooms are isolated after refactoring? You test it.

## Next: v5 — Add Testing
