# v2 — Add TypeScript (Chat Rooms)

## The Scenario

It's 2am. Your junior is debugging why some messages show `sender: undefined`. "I'm emitting `{ room, text }` from the client," they say. You check the server: it expects `{ room, message }`. JavaScript destructures `undefined` silently.

## The PAIN: Event Payload Shape Mismatch

From v1:

```javascript
// Client emits
socket.emit('message', { room: 'general', text: 'hello' });

// Server expects
socket.on('message', (data) => {
  io.emit('message', {
    room: data.room,
    text: data.message, // <-- 'message' is undefined, should be 'text'
    sender: socket.id,
  });
});
```

No crash. The message just has `text: undefined`. Users see blank messages. You spend an hour comparing client and server code before finding the mismatch.

## The Solution: TypeScript Event Types

```typescript
// types.ts
export interface ChatMessage {
  room: string;
  text: string;
  sender: string;
  timestamp: number;
}

export interface JoinPayload {
  room: string;
}

export interface NotificationPayload {
  text: string;
}
```

```typescript
// socket.ts
import { Server, Socket } from 'socket.io';
import { ChatMessage, JoinPayload } from './types.js';

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('join', (room: string) => {
      socket.join(room);
      socket.to(room).emit('notification', { text: `${socket.id} joined` });
    });
    
    socket.on('message', (data: { room: string; text: string }) => {
      // TypeScript ensures 'data' has 'room' and 'text' properties
      const msg: ChatMessage = {
        room: data.room,
        text: data.text,
        sender: socket.id,
        timestamp: Date.now(),
      };
      io.emit('message', msg); // BUG still here: broadcasts to ALL
    });
  });
}
```

### What TypeScript catches:

| Scenario | JavaScript | TypeScript |
|----------|-----------|------------|
| `data.msg` instead of `data.text` | Runtime `undefined` | **Compile error**: Property 'msg' does not exist |
| Emit wrong event name | Runtime: client never receives | **Compile error** (with typed Socket.IO) |
| Forget `sender` in message | Runtime `undefined` | **Compile error**: Property 'sender' is missing |
| Wrong payload shape | Silent data corruption | **Compile error**: Type mismatch |

## The New PAIN: Socket.IO is Loosely Typed by Default

```typescript
socket.on('message', (data: any) => {
  // Default Socket.IO types allow any
  // You must explicitly type your events
});
```

Without disciplined typing, Socket.IO events become "any soup." Every event handler accepts `any`, trusts the payload, and hopes for the best.

## The Realization

> Junior: "TypeScript caught that the client sends `text` but the server was reading `message`."
> 
> You: "Event-driven architectures are especially vulnerable to shape mismatches because there's no HTTP response to validate against. TypeScript is your only safety net."

## Why this matters for Chat Rooms

Real-time systems have complex state:
- Rooms: `Map<string, Set<string>>`
- Messages: `{ room, text, sender, timestamp }`
- Socket IDs: strings that must match between server memory and Socket.IO internals

Without types:
- You might use `socket.id` in one place and `socket.handshake.auth.userId` in another
- You might forget `timestamp` and break message ordering
- You might emit the wrong event name and wonder why clients never receive

With types, the compiler is your contract enforcer.

## Next: v3 — Add Validation
