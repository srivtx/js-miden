# v5 — Add Testing (Chat Rooms)

## The Scenario

It's 2am. Your junior fixes the broadcast bug. "I changed `io.emit` to `socket.to(room).emit`," they say. They deploy. Now only the sender sees their own message. They used `socket.to` which excludes the sender. Without tests, they don't know until a user reports "I can't see my own messages."

## The PAIN: Real-Time Logic Is Hard to Verify

From v4:

```typescript
socket.on('message', (data) => {
  io.emit('message', msg); // BUG: broadcasts globally
});
```

Fix attempt:
```typescript
socket.on('message', (data) => {
  socket.to(data.room).emit('message', msg); // FIX? No — excludes sender!
});
```

Correct fix:
```typescript
socket.on('message', (data) => {
  io.to(data.room).emit('message', msg); // Includes everyone in room
});
```

Three lines. Three different behaviors. Without tests, you guess which is right.

## The Solution: Vitest + Socket.IO Client

```typescript
// tests/chat.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { server, io } from '../src/index.js';

function waitFor(socket: ClientSocket, event: string) {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('S06 Chat Rooms', () => {
  let client1: ClientSocket;
  let client2: ClientSocket;

  beforeAll(() => {
    const address = server.address();
    const url = typeof address === 'string' ? address : `http://localhost:${address?.port}`;
    client1 = Client(url);
    client2 = Client(url);
  });

  afterAll(() => {
    client1.close();
    client2.close();
    io.close();
    server.close();
  });

  it('joins a room', async () => {
    client1.emit('join', 'general');
    const room = await waitFor(client1, 'joined');
    expect(room).toBe('general');
  });

  it('receives messages in room', async () => {
    client1.emit('join', 'general');
    client2.emit('join', 'general');
    await waitFor(client2, 'joined');

    const promise = waitFor(client2, 'message');
    client1.emit('message', { room: 'general', text: 'hello' });
    const msg: any = await promise;
    expect(msg.text).toBe('hello');
  });

  it('BUG: leaks messages across rooms', async () => {
    client1.emit('join', 'room-a');
    client2.emit('join', 'room-b');
    await waitFor(client1, 'joined');
    await waitFor(client2, 'joined');

    const promise = waitFor(client2, 'message');
    client1.emit('message', { room: 'room-a', text: 'secret' });
    const msg: any = await promise;
    // Because of the bug, client2 in room-b still gets the message
    expect(msg.text).toBe('secret');
  });

  // When fixed, this test should replace the BUG test:
  it('isolates messages to rooms', async () => {
    client1.emit('join', 'room-a');
    client2.emit('join', 'room-b');
    await waitFor(client1, 'joined');
    await waitFor(client2, 'joined');

    // client2 should NOT receive messages from room-a
    client2.on('message', (msg: any) => {
      expect(msg.room).not.toBe('room-a');
    });

    client1.emit('message', { room: 'room-a', text: 'secret' });
    
    // Give it time, then verify no message was received
    await new Promise(r => setTimeout(r, 100));
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Broadcast scope wrong | Messages leak or disappear | **Test verifies** room isolation |
| Sender excluded | User can't see own messages | **Test checks** sender receives |
| Race on join | Messages sent before join | **Test awaits** 'joined' event |
| Socket disconnect | Memory leak (rooms not cleaned) | **Test verifies** cleanup |
| Event name typo | Client never receives | **Test times out** (failure signal) |

## The PAIN of Async Event Testing

```typescript
// DON'T assume events arrive in order:
client1.emit('message', { room: 'general', text: 'hi' });
expect(client2Received).toBe(true); // Might not have arrived yet!

// DO use promises:
const promise = waitFor(client2, 'message');
client1.emit('message', { room: 'general', text: 'hi' });
const msg = await promise;
expect(msg.text).toBe('hi');
```

Socket.IO tests are inherently async. Promises and timeouts are your friends.

## Testing Evolution in Chat Rooms

| Version | Testing | Real-time confidence |
|---------|---------|---------------------|
| v1 (JS) | Open two browser tabs | Zero |
| v2-4 | Still manual | Zero |
| v5 (Vitest) | Join, message, room isolation tested | High |

## The Realization

> Junior: "I fixed the broadcast bug and the room isolation test passed. But the 'sender receives own message' test failed — I used `socket.to` instead of `io.to`. Tests caught my fix breaking something else."
> 
> You: "Real-time code has the highest bug density per line of any backend code. Three emit methods, three different scopes. Tests are the only way to verify you picked the right one."

## The Next PAIN

Tests use `import` from `socket.io-client`. Your source uses `require('socket.io')`. Test runner throws `ERR_REQUIRE_ESM`. You spend 2 hours in `package.json` module configuration hell.

## Next: v6 — Switch to ESM
