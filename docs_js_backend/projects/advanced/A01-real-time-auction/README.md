# A01: Real-time Auction System

Live auction with WebSocket bidding, auto-extension, and anti-sniping.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auctions | POST | Create auction |
| /api/auctions/:id | GET | Get auction state |
| /api/auctions/:id/bids | POST | Place bid (HTTP fallback) |
| /ws | WS | WebSocket for real-time updates |

## Architecture

- **State Machine**: CREATED → ACTIVE → EXTENDED → CLOSED
- **Bid Atomicity**: PostgreSQL advisory locks + transactions
- **Real-time**: WebSocket broadcasts to all connected clients
- **Anti-sniping**: Auto-extend 30 seconds if bid in last 30s

## Known Issues (for debugging practice)

1. **BUG**: Race condition in bidding (read current bid, then write - not atomic)
2. **BUG**: No validation that bid is higher than current highest bid

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
