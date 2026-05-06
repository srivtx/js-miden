# Development Guide

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Project Structure

```
src/
  index.ts           # Express app setup
  config.ts          # Environment config
  types.ts           # TypeScript interfaces
  db.ts              # In-memory storage
  middleware/
    auth.ts          # JWT authentication
  routes/
    orders.ts        # Order CRUD + matching
    trades.ts        # Trade queries
  services/
    matchingEngine.ts # Core matching logic
    marketData.ts     # Order book aggregation
```

## Adding a New Order Type

1. Update `OrderType` in `types.ts`
2. Modify `matchOrder` in `matchingEngine.ts`
3. Add validation in `orders.ts`
4. Write tests

## Testing Matching Logic

Use the in-memory DB for unit tests:
```typescript
resetDb();
// Create orders
// Trigger match
// Assert trades
```
