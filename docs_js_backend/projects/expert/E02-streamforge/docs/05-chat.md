# Live Chat

## Overview
The Chat Service provides real-time messaging during streams via WebSocket connections.

## Architecture

```
┌─────────┐     WebSocket       ┌──────────────┐
│ Viewer  │ ◄─────────────────► │ Chat Service │
│   A     │                     │   (4002)     │
└─────────┘                     └──────┬───────┘
                                       │
                              Redis Pub/Sub ◄──► Other Instances
                                       │
┌─────────┐     WebSocket            │
│ Viewer  │ ◄─────────────────────────┘
│   B     │
└─────────┘
```

## WebSocket Protocol

### Connection
```javascript
const ws = new WebSocket('ws://localhost:4002/ws?channel=channel123');
```

### Incoming Messages
```json
{
  "type": "system",
  "message": "Connected to chat"
}
```

### Sending Messages
```json
{
  "username": "viewer1",
  "message": "Great stream!",
  "userId": "user456"
}
```

### Receiving Messages
```json
{
  "type": "chat",
  "username": "viewer1",
  "message": "Great stream!",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Chat Features
- Channel isolation (messages only within same channel)
- Cross-instance sync via Redis
- Connection status notifications
- Message rate limiting (recommended)

## API Endpoints

### Get Chat History
```
GET /history/:channelId

Response 200:
{
  "messages": [
    {
      "username": "viewer1",
      "message": "Hello!",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

## Known Vulnerability
**Messages are not persisted to the database.**

The WebSocket handler broadcasts messages to connected clients but never calls `ChatMessage.create()`. This means:
1. New viewers don't see previous messages
2. Chat history API returns empty results
3. Messages are lost if the server restarts

### Fix
```typescript
// In WebSocket message handler:
await ChatMessage.create({
  channelId,
  userId: message.userId,
  username: message.username,
  message: message.message,
});
```

See `07-security.md` for additional issues.
