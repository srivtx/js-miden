# API Reference

## Authentication

HTTP endpoints require Bearer token. WebSocket connects with query parameter.

## HTTP Endpoints

### POST /api/auctions
Create a new auction.

**Body:**
```json
{
  "title": "Vintage Watch",
  "description": "1960s Rolex",
  "startingPrice": 1000,
  "endsAt": "2024-12-31T23:59:59Z"
}
```

### GET /api/auctions/:id
Get auction state and bid history.

### POST /api/auctions/:id/bids
Place a bid.

**Body:**
```json
{
  "amount": 1500
}
```

**BUGS:**
- No validation that amount > current price
- Race condition: read-then-write is not atomic

## WebSocket

### Connect
```
ws://localhost:3000/ws?auctionId=<auction-id>
```

### Messages

**State Update:**
```json
{
  "type": "state",
  "auction": {
    "id": "uuid",
    "currentPrice": 1500,
    "status": "active"
  }
}
```

**New Bid:**
```json
{
  "type": "bid",
  "bid": {
    "id": "uuid",
    "amount": 1500,
    "bidderId": "uuid"
  }
}
```
