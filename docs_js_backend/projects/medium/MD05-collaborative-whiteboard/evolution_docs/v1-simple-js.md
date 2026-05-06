# MD05 Collaborative Whiteboard — v1 Simple JS

## The Naive Implementation

You need a shared drawing board. Simple:

```js
// server.js
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const board = []; // array of stroke objects

wss.on('connection', (ws) => {
  // Send current board to new client
  ws.send(JSON.stringify({ type: 'init', strokes: board }));

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'stroke') {
      board.push(msg.stroke);
      // Broadcast to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'stroke', stroke: msg.stroke }));
        }
      });
    }
  });
});

server.listen(3000);
```

Works locally: two browsers open, draw a line, both see it. Magic.

## Then the Pain Hits

### 1. No Sync on Join

A new user connects after 500 strokes. You send all 500 strokes at once. The WebSocket frame is 5MB. The browser freezes parsing JSON. The user thinks the app is broken.

### 2. Out-of-Order Messages

User A draws a circle. User B draws a square. Due to network jitter, User B's phone receives the square before the circle. Their screen shows the square under the circle. Desktop shows circle under square. Divergent reality.

### 3. Concurrent Edits

User A deletes a stroke. User B moves the same stroke. Your server processes delete, then move. The move references a non-existent stroke. The client crashes.

### 4. No Persistence

Server restarts. The `board` array vanishes. Hours of collaborative work disappear. A design team loses a week's worth of wireframes.

### 5. Cursor Chaos

Every mouse move broadcasts a message. 10 users × 60fps = 600 messages/second. The server CPU melts. The UI lags. It's unusable.

## The Realization

Broadcasting raw strokes is fine for a demo. A collaborative whiteboard needs:

1. **Efficient sync** — deltas, snapshots, paginated history
2. **Ordering guarantees** — sequence numbers, operational transforms
3. **Conflict resolution** — CRDTs or locking for concurrent edits
4. **Persistence** — database with efficient stroke storage
5. **Session replay** — record and playback for review
6. **Throttling** — cursor updates at 10fps, not 60fps

This is where the evolution starts.
