# A08 Evolution: v1 — Simple JavaScript

## State of the System

The signaling server is a single WebSocket echo script. Peers can connect, but there is no concept of rooms, no SDP relay logic, and no ICE candidate forwarding. It is a proof-of-concept that messages travel in both directions.

## What Works

- `ws.on('connection', ...)` accepts any client.
- `ws.on('message', ...)` broadcasts the raw message to every other connected socket.
- Peers can send arbitrary JSON and see it appear on the other side.

## What Does NOT Work

- **No room isolation.** Every peer sees every message. A video call between Alice and Bob is interrupted by messages from Carol and Dave, who are in a completely different call.
- **No SDP relay.** The browser's `RTCPeerConnection` produces an offer, but the server does not know which peer should receive it. The offer is broadcast to all connected clients, most of whom reject it.
- **No ICE candidate forwarding.** Browsers generate host, srflx, and relay candidates, but the server treats them as opaque strings. They are broadcast globally rather than targeted to the intended peer.
- **No presence tracking.** A peer who disconnects abruptly (WiFi drop) is never removed. The broadcast list grows with ghost sockets, and `ws.send()` throws `ECONNRESET` repeatedly.

## Code Snapshot (server.js)

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('message', (data) => {
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(data);
      }
    }
  });
  ws.on('close', () => clients.delete(ws));
});
```

## Architectural Notes

This is the "basic WebSocket" stage. The server is a message bus with no semantics. WebRTC signaling requires targeted, typed messages (offer, answer, ice-candidate), but the server treats all messages as generic blobs. The P2P media path (SRTP/UDP) does not exist yet because the signaling handshake cannot complete.

## Migration Path to v2

1. Introduce the concept of a `Room` — a named scope that limits message visibility.
2. Add typed message handling (`offer`, `answer`, `ice-candidate`) with explicit `targetPeerId`.
3. Track peer presence and validate that both sender and receiver are in the same room before relaying.
