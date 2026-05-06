# S06 Chat Rooms — API Reference

## Socket.io Events

All communication is event-based over the WebSocket connection.

### Client → Server Events

#### `join`
Subscribe to a room.
```json
{
  "room": "engineering"
}
```
**Behavior**: Server adds socket to the room, updates in-memory registry, emits `joined` back to sender and `notification` to other room members.

#### `message`
Send a message to a room.
```json
{
  "room": "engineering",
  "text": "Hello team!"
}
```
**Behavior**: Server broadcasts the message. **Note**: The current implementation has a bug—it uses `io.emit()` which broadcasts to **all** connected clients globally, not just the target room. The fix is `socket.to(room).emit(...)`.

#### `leave`
Unsubscribe from a room.
```json
"engineering"
```
**Behavior**: Removes socket from room registry, emits `notification` to remaining members.

### Server → Client Events

#### `joined`
Acknowledgment that the client has joined a room.
```json
"engineering"
```

#### `notification`
System message about room membership changes.
```json
{
  "text": "abc123 joined engineering"
}
```

#### `message`
A chat message payload.
```json
{
  "room": "engineering",
  "text": "Hello team!",
  "sender": "abc123"
}
```

#### `disconnect`
Built-in Socket.io event fired when the connection closes.

## HTTP Endpoints

The Express server only serves static assets:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serves `public/index.html` |

No REST API is exposed for chat operations.

## Error Scenarios

| Scenario | Current Behavior | Recommended Fix |
|----------|------------------|-----------------|
| Missing room in `message` | Broadcasts with `room: undefined` | Validate `room` exists and client is a member |
| Duplicate `join` | Re-adds socket ID to Set (no-op) | Acceptable; Set deduplicates |
| Server crash | All rooms and connections lost | Add Redis persistence or database logging |
