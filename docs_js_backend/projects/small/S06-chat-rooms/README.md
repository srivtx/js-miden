# S06 Real-time Chat (2 Rooms)

## Concepts
- Socket.io rooms & namespaces
- Broadcasting vs targeted emits
- Presence / join-leave notifications
- Scaling with Redis adapter (concept)

## Phase 1
- Users join a room, send messages, and see join/leave notifications.
- Two rooms supported (`general`, `random`).
- No persistence (in-memory only).

## Phase 2-3 Thinking Framework
1. **Room-scoped Broadcasts**: Always use `io.to(room).emit(...)` or `socket.to(room).emit(...)` so messages only reach clients in that room. `io.emit` sends to **all** sockets.
2. **Input Sanitization**: Strip `<script>` tags or escape HTML to prevent XSS. Never render raw user input in the DOM.
3. **Presence**: Maintain a room-user map. On disconnect, clean up and notify the room.
4. **Scaling**: A single Node process can't scale horizontally. Introduce a Redis adapter so `io.to(room).emit` works across multiple servers.
5. **Rate Limiting**: Prevent spam by throttling messages per socket (e.g., 1 msg/sec).

## Bug
- **Privacy leak**: The `message` handler uses `io.emit(...)` which broadcasts to **every connected client globally**, not just the target room. Users in one room see messages from another room.
- **XSS risk**: No input sanitization on message text. A user can send `<script>alert('xss')</script>`.

## Run
```bash
npm install
npm run dev
# Open http://localhost:3000 in two tabs, join different rooms, and observe the leak.
```

## Test
```bash
npm test
```
