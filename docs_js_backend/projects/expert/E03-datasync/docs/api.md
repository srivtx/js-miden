# API Reference

## HTTP Endpoints

### GET /api/health
Server health and statistics.

**Response:**
```json
{
  "status": "ok",
  "peers": 5,
  "documents": 120,
  "tombstones": 15
}
```

### GET /api/documents
List all active documents.

**Response:**
```json
{
  "documents": [
    {
      "id": "doc-1",
      "type": "register",
      "data": { "title": "Hello" },
      "vectorClock": { "peer1": 1, "server": 1 },
      "timestamp": 1704067200000
    }
  ]
}
```

### GET /api/documents/:id
Get a specific document.

### POST /api/documents/:id
Create or update a document.

**Request:**
```json
{
  "title": "Updated Title",
  "content": "New content"
}
```

### DELETE /api/documents/:id
Delete a document.

### GET /api/presence
Get presence information for all peers.

**Response:**
```json
{
  "presence": [
    {
      "peerId": "peer-1",
      "status": "online",
      "lastSeen": 1704067200000,
      "cursor": { "documentId": "doc-1", "position": 42 }
    }
  ]
}
```

### GET /api/sync/peers
List connected peers.

### GET /api/conflicts
Get conflict resolution statistics.

## WebSocket Messages

### Connection
```
ws://localhost:3000?peerId=peer-123
```

### Client → Server

#### Sync Request
```json
{
  "type": "sync",
  "peerId": "peer-1",
  "vectorClock": { "peer1": 5 }
}
```

#### Delta Update
```json
{
  "type": "delta",
  "peerId": "peer-1",
  "delta": [
    {
      "type": "set",
      "documentId": "doc-1",
      "path": "/title",
      "value": "New Title",
      "vectorClock": { "peer1": 6 }
    }
  ]
}
```

#### Acknowledgment
```json
{
  "type": "ack",
  "peerId": "peer-1",
  "vectorClock": { "peer1": 6, "server": 6 }
}
```

### Server → Client

#### Full Sync
```json
{
  "type": "sync",
  "peerId": "server",
  "documents": [ ... ],
  "vectorClock": { "peer1": 5, "peer2": 3, "server": 8 }
}
```

#### Delta Broadcast
```json
{
  "type": "delta",
  "peerId": "server",
  "delta": [ ... ]
}
```

## Error Responses

```json
{ "type": "error", "message": "Invalid message format" }
```

## References

[1] WebSocket Protocol, RFC 6455.
[2] "Designing Real-Time Collaboration APIs," Figma Engineering Blog, 2020.