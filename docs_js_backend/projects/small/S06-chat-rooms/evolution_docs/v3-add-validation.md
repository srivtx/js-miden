# v3 — Add Validation (Chat Rooms)

## The Scenario

It's 2am. Your junior added TypeScript. "Event payloads are typed!" they celebrate. Then a user emits `socket.emit('message', { room: '', text: 'a'.repeat(100000) })` and the server broadcasts a 100KB message to every connected client. TypeScript saw `{ room: string, text: string }` — both valid.

## The PAIN: Type Safety ≠ Content Safety

From v2:

```typescript
socket.on('message', (data: { room: string; text: string }) => {
  const msg: ChatMessage = {
    room: data.room,
    text: data.text,
    sender: socket.id,
    timestamp: Date.now(),
  };
  io.emit('message', msg); // Broadcasts to ALL
});
```

### Real attacks:

```javascript
// Message bomb:
socket.emit('message', { room: 'general', text: 'a'.repeat(100000) });
// Server broadcasts 100KB to 1,000 clients = 100MB outbound

// Empty room:
socket.emit('message', { room: '', text: 'hello' });
// Joins/broadcasts to empty string room. Undefined behavior.

// XSS payload:
socket.emit('message', { room: 'general', text: '<script>alert(1)</script>' });
// Client renders HTML. Stored XSS in chat history.
```

## The Solution: Zod Validation for Socket Events

```typescript
import { z } from 'zod';

const messageSchema = z.object({
  room: z.string().min(1).max(50).regex(/^[a-z0-9\-]+$/),
  text: z.string().min(1).max(2000),
});

const joinSchema = z.string().min(1).max(50).regex(/^[a-z0-9\-]+$/);
```

```typescript
// socket.ts
import { Server, Socket } from 'socket.io';
import { z } from 'zod';

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('join', (rawRoom: string) => {
      const parseResult = joinSchema.safeParse(rawRoom);
      if (!parseResult.success) {
        socket.emit('error', { message: 'Invalid room name' });
        return;
      }
      const room = parseResult.data;
      
      socket.join(room);
      socket.to(room).emit('notification', { text: `${socket.id} joined` });
      socket.emit('joined', room);
    });
    
    socket.on('message', (rawData: unknown) => {
      const parseResult = messageSchema.safeParse(rawData);
      if (!parseResult.success) {
        socket.emit('error', { message: 'Invalid message format' });
        return;
      }
      
      const data = parseResult.data;
      const msg = {
        room: data.room,
        text: data.text, // Could sanitize here: escape HTML
        sender: socket.id,
        timestamp: Date.now(),
      };
      
      // BUG STILL HERE: io.emit broadcasts globally
      // But at least the payload is validated
      io.emit('message', msg);
    });
  });
}
```

### What validation catches:

| Input | TypeScript | Zod validation | Result |
|-------|-----------|----------------|--------|
| `room=""` | ✓ Valid string | **Error**: Min 1 char | Rejected |
| `text="a".repeat(10000)` | ✓ Valid string | **Error**: Max 2000 chars | Rejected |
| `room="general room"` | ✓ Valid | **Error**: Invalid characters | Rejected (spaces) |
| `text="<script>..."` | ✓ Valid | Passes, needs sanitization | Sanitize in handler |
| Missing `text` field | Compile error | **Error**: Required | Rejected |

## The PAIN of Untyped Socket Events

Socket.IO's default `data: any` is convenient and dangerous:

```typescript
// Without validation, any payload shape is accepted
socket.on('message', (data: any) => {
  // data might be a string, number, array, null...
  // TypeScript can't help you here
});
```

Always validate at the event boundary. Treat socket payloads like HTTP request bodies — **hostile until proven otherwise**.

## Validation Evolution in Chat Rooms

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Message bombs, empty rooms, XSS |
| v2 (TS) | Shape only | Content attacks still possible |
| v3 (Zod) | Shape + constraints | Payloads are safe (broadcast bug remains) |

## The Realization

> Junior: "Zod rejected a 10,000-character message. Without that, one user could have broadcast 100MB to everyone."
> 
> You: "Real-time systems amplify attacks. One bad message hits every connected client instantly. Validation isn't optional — it's your circuit breaker."

## The Next PAIN

Validation keeps payloads safe, but when a user reports "I didn't get my message," you have no logs. Socket.IO errors go to console and vanish. You can't debug what you can't see.

## Next: v4 — Add Logging
