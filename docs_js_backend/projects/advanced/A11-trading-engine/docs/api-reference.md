# API Reference

## Authentication

All endpoints require Bearer token.

## Orders

### POST /api/orders
Create a new order.

**Body:**
```json
{
  "symbol": "AAPL",
  "side": "buy",
  "type": "limit",
  "price": 150.00,
  "quantity": 100
}
```

**Response:**
```json
{
  "id": "uuid",
  "symbol": "AAPL",
  "side": "buy",
  "type": "limit",
  "price": 150.00,
  "quantity": 100,
  "filledQuantity": 0,
  "status": "open",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**BUGS:**
- No price validation (accepts negative prices)
- Race condition in matching

### GET /api/orders/:symbol
Get all orders for a symbol.

### PATCH /api/orders/:id/cancel
Cancel an open order.

## Trades

### GET /api/trades/:symbol
Get executed trades for a symbol.

**Response:**
```json
[
  {
    "id": "uuid",
    "buyOrderId": "uuid",
    "sellOrderId": "uuid",
    "symbol": "AAPL",
    "price": 150.00,
    "quantity": 50,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```
