# Development Guide

## Setup

```bash
npm install
docker-compose up -d postgres redis
npm run dev
```

## Project Structure

```
src/
  index.ts          # Entry point
  config.ts         # Configuration
  db.ts             # Database connections
  middleware/       # Auth middleware
  routes/           # API routes
  websocket.ts      # WebSocket handler
  types.ts          # TypeScript types
tests/              # Test suites
docs/               # Documentation
```

## Running Tests

```bash
npm test
```

## Debugging Race Conditions

The race condition is in `src/routes/auctions.ts`:
- Reads `auction.currentPrice`
- Then writes new bid without locking
- Fix: Use database transactions with `FOR UPDATE`

## Debugging Bid Validation

The validation bug is in `src/routes/auctions.ts`:
- No check that `amount > auction.currentPrice`
- Fix: Add validation before accepting bid
