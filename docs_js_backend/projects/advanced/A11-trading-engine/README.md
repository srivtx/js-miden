# A11: High-Frequency Trading Engine

Order matching engine with price-time priority, limit/market orders, and order book management.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/orders | POST | Create order (limit/market) |
| /api/orders/:symbol | GET | Get orders by symbol |
| /api/orders/:id/cancel | PATCH | Cancel an order |
| /api/trades/:symbol | GET | Get trades for symbol |

## Architecture

- **Order Service**: Receives orders, validates, persists
- **Matching Engine**: Price-time priority FIFO matching
- **Market Data Service**: Order book snapshots, trade history
- **Trade Service**: Trade execution records, settlement

## Known Issues (for debugging practice)

1. **BUG**: Race condition in matching (two orders match same counterparty, one over-filled)
2. **BUG**: No price validation (accepts negative prices)

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
