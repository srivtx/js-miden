# API Documentation

## Event Ingestion API

### POST /events
Ingest a single event or batch of events.

**Request**:
```json
{
  "eventType": "page_view",
  "payload": {
    "url": "/products/123",
    "value": 1
  },
  "source": "web",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Batch Request**:
```json
[
  {
    "eventType": "page_view",
    "payload": { "url": "/products/123" },
    "source": "web"
  },
  {
    "eventType": "add_to_cart",
    "payload": { "productId": "123", "quantity": 2 },
    "source": "web"
  }
]
```

**Response**:
```json
{
  "ingested": 2,
  "eventIds": ["uuid-1", "uuid-2"]
}
```

**Error Response**:
```json
{
  "error": "Batch size exceeds maximum of 100"
}
```

## Dashboard API

### GET /metrics
Get current metrics across all event types.

**Query Parameters**:
- `eventType` (optional): Filter by event type
- `window` (optional): Specific window key

**Response**:
```json
{
  "metrics": [
    {
      "eventType": "page_view",
      "window": "2024-01-01T12:00:00.000Z",
      "count": 1543,
      "ratePerSecond": 25,
      "sum": 1543,
      "timestamp": "2024-01-01T12:01:00Z"
    }
  ],
  "window": "2024-01-01T12:00:00.000Z"
}
```

### GET /metrics/timeseries
Get time-series data for the last N hours.

**Query Parameters**:
- `eventType` (required): Event type to query
- `hours` (optional): Number of hours (default: 24, max: 168)

**Response**:
```json
{
  "eventType": "page_view",
  "realTime": [
    {
      "window": "2024-01-01T11:00:00.000Z",
      "count": 1200
    },
    {
      "window": "2024-01-01T12:00:00.000Z",
      "count": 1543
    }
  ],
  "historical": [
    {
      "metricName": "page_view",
      "windowStart": "2024-01-01T11:00:00Z",
      "count": 1200,
      "sum": 1200,
      "avg": 1
    }
  ]
}
```

### GET /metrics/rates
Get current event rates.

**Response**:
```json
{
  "rates": [
    {
      "eventType": "page_view",
      "eventsPerSecond": 25
    },
    {
      "eventType": "add_to_cart",
      "eventsPerSecond": 5
    }
  ]
}
```

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_INPUT | Validation failed |
| 400 | BATCH_TOO_LARGE | Exceeds batch size limit |
| 404 | EVENT_TYPE_NOT_FOUND | No events for type |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

## Rate Limiting

Default limits:
- 10,000 events per second per IP
- 100 events per batch
- 1MB max request body

## Event Schema

### Required Fields
- `eventType`: String, 1-100 chars
- `payload`: Object

### Optional Fields
- `source`: String, 1-200 chars (default: "api")
- `timestamp`: ISO 8601 datetime (default: now)

## Client Examples

### cURL
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "purchase",
    "payload": {
      "amount": 99.99,
      "currency": "USD",
      "productId": "prod-123"
    },
    "source": "mobile_app"
  }'
```

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'page_view',
    payload: { url: window.location.pathname },
  }),
});
```

### Python
```python
import requests

response = requests.post('http://localhost:3000/events', json={
    'eventType': 'page_view',
    'payload': {'url': '/products/123'},
})
```

## References

- REST API Design: https://restfulapi.net/
- Time-Series Databases: https://www.influxdata.com/time-series-database/