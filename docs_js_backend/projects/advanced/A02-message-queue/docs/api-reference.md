# API Reference

## Endpoints

### POST /api/queues/:queue/messages
Publish a message to a queue.

**Body:**
```json
{
  "body": "message content",
  "headers": {
    "key": "value"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "queue": "my-queue"
}
```

### GET /api/queues/:queue/messages
Consume a message from a queue.

**Response:**
```json
{
  "id": "uuid",
  "body": "message content",
  "headers": {},
  "deliveryCount": 1,
  "ackId": "ack-uuid"
}
```

**BUG:** Messages may be delivered out of order.

### POST /api/queues/:queue/messages/:id/ack
Acknowledge and remove a message.

**Body:**
```json
{
  "ackId": "ack-uuid"
}
```

### GET /api/queues/:queue/stats
Get queue statistics.

### POST /api/topics/:topic/subscribe
Subscribe a queue to a topic.

**Body:**
```json
{
  "queueName": "my-queue"
}
```

### POST /api/topics/:topic/publish
Publish to all subscribed queues.

**Body:**
```json
{
  "body": "broadcast message"
}
```
