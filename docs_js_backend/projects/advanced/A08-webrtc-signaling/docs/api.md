# API Reference

## HTTP Endpoints

### GET /api/health
Returns server health and statistics.

**Response:**
```json
{
  "status": "ok",
  "peers": 12,
  "rooms": 3,
  "iceCandidates": 1450
}
```

### GET /api/rooms
List all active rooms.

**Response:**
```json
[
  { "roomId": "room-1", "peerCount": 4, "maxPeers": 8 },
  { "roomId": "room-2", "peerCount": 2, "maxPeers": 8 }
]
```

### GET /api/rooms/:roomId
Get room details including peer list.

**Response:**
```json
{
  "peerCount": 4,
  "maxPeers": 8,
  "createdAt": 1704067200000,
  "peers": ["peer-1", "peer-2", "peer-3", "peer-4"],
  "presence": ["peer-1", "peer-2", "peer-3", "peer-4"]
}
```

### GET /api/ice/candidates
Get ICE candidate statistics (debugging).

**Response:**
```json
{
  "totalCandidates": 1450,
  "totalRelays": 2900
}
```

## WebSocket Messages

### Connection
```
ws://localhost:3000?peerId=peer-123
```

### Client → Server Messages

#### Join Room
```json
{
  "type": "join",
  "roomId": "room-1"
}
```

#### Leave Room
```json
{
  "type": "leave",
  "roomId": "room-1"
}
```

#### Send Offer
```json
{
  "type": "offer",
  "roomId": "room-1",
  "targetPeerId": "peer-456",
  "payload": {
    "type": "offer",
    "sdp": "v=0\r\n..."
  }
}
```

#### Send Answer
```json
{
  "type": "answer",
  "roomId": "room-1",
  "targetPeerId": "peer-456",
  "payload": {
    "type": "answer",
    "sdp": "v=0\r\n..."
  }
}
```

#### Send ICE Candidate
```json
{
  "type": "ice-candidate",
  "roomId": "room-1",
  "targetPeerId": "peer-456",
  "payload": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### Server → Client Messages

Server mirrors the same message format, setting `peerId` to the sender's ID.

## Error Responses

All errors return JSON with an `error` field:
```json
{ "error": "Room not found" }
```

## References

[1] WebSocket API, MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
[2] Express.js 5.0 API Reference. https://expressjs.com/en/5x/api.html