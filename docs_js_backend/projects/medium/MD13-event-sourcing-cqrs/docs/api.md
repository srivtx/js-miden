# API Documentation

## Commands API

### POST /orders
Place a new order.

**Request**:
```json
{
  "customerId": "550e8400-e29b-41d4-a716-446655440000",
  "items": [
    {
      "productId": "550e8400-e29b-41d4-a716-446655440001",
      "quantity": 2,
      "unitPrice": 29.99
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Springfield",
    "country": "USA",
    "zipCode": "12345"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440002",
    "version": 1
  }
}
```

### POST /orders/:id/cancel
Cancel an existing order.

**Request**:
```json
{
  "reason": "Changed my mind",
  "cancelledBy": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440002",
    "version": 2
  }
}
```

**Error Response**:
```json
{
  "error": "Cannot cancel order in SHIPPED status"
}
```

## Queries API

### GET /orders/:id
Get order by ID.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "aggregateId": "...",
    "customerId": "...",
    "status": "PENDING",
    "totalAmount": 59.98,
    "items": [...],
    "shippingAddress": {...},
    "version": 1,
    "projectedAt": "2024-01-01T12:00:00Z"
  }
}
```

### GET /orders
List orders with filters.

**Query Parameters**:
- `customerId`: Filter by customer
- `status`: Filter by status
- `limit`: Page size (default: 20)
- `offset`: Page offset (default: 0)

**Response**:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

## Event Store API (Internal)

### Append Event
```typescript
await eventStore.append({
  id: 'event-id',
  aggregateId: 'order-id',
  aggregateType: 'Order',
  eventType: 'OrderPlaced',
  eventData: { ... },
  version: 1,
  createdAt: new Date(),
  metadata: { correlationId: '...' },
});
```

### Get Events
```typescript
const events = await eventStore.getEvents('order-id');
```

### Replay Aggregate
```typescript
const state = await eventStore.replayAggregate('order-id');
```

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_INPUT | Validation failed |
| 404 | ORDER_NOT_FOUND | Order doesn't exist |
| 409 | INVALID_STATE | Cannot perform action in current state |
| 422 | CONCURRENCY_ERROR | Optimistic concurrency conflict |
| 500 | INTERNAL_ERROR | Server error |

## Eventual Consistency

After placing an order:
1. Command returns immediately
2. Event stored in write model
3. Projection updates read model (async)
4. Read model reflects changes (eventually)

**Handling**:
- Return 202 Accepted with polling URL
- Use SSE for real-time updates
- Implement retry with exponential backoff

## Client Examples

### Place Order
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      {
        "productId": "550e8400-e29b-41d4-a716-446655440001",
        "quantity": 2,
        "unitPrice": 29.99
      }
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "Springfield",
      "country": "USA",
      "zipCode": "12345"
    }
  }'
```

### Poll for Order
```bash
# After placing order, poll until available
curl http://localhost:3001/orders/{orderId}
```

## References

- CQRS Pattern: https://martinfowler.com/bliki/CQRS.html
- Event Sourcing: https://martinfowler.com/eaaDev/EventSourcing.html
- REST API Design: https://restfulapi.net/