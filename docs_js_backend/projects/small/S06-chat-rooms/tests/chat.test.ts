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

  it('BUG: leaks messages across rooms because io.emit broadcasts globally', async () => {
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
});
