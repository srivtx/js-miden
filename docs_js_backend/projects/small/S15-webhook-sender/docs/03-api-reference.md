# API Reference

## POST /api/webhooks

Register a new webhook.

**Request Body:**
```json
{
  "url": "https://example.com/webhook",
  "event_types": ["order.created", "order.updated"],
  "secret": "my-secret-key"
}
```

**Response:**
```json
{
  "webhook": {
    "id": 1,
    "url": "https://example.com/webhook",
    "event_types": ["order.created", "order.updated"],
    "secret": "my-secret-key",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## POST /api/events

Trigger an event to all matching webhooks.

**Request Body:**
```json
{
  "event_type": "order.created",
  "payload": { "order_id": 123, "total": 49.99 }
}
```

**Response:**
```json
{
  "queued": 3
}
```

## GET /api/webhooks/:id/logs

Get delivery logs for a webhook.

**Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "event_type": "order.created",
      "status": "success",
      "attempt_count": 1,
      "response_status": 200,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```
