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
  middleware/       # Auth, rate limiting
  routes/           # API routes
  services/         # Business logic
  types.ts          # TypeScript types
tests/              # Test suites
docs/               # Documentation
```

## Running Tests

```bash
npm test
```

## Adding Features

1. Create route handler in `src/routes/`
2. Add business logic in `src/services/`
3. Write tests in `tests/`
4. Update documentation

## Debugging Fan-out

The fan-out bug is in `src/routes/posts.ts`:
- `fanOutPost()` is called synchronously
- For large follower counts, this blocks the response
- Fix: Use a background job queue (Bull, BullMQ)

## Debugging Pagination

The pagination bug is in `src/routes/posts.ts`:
- Uses `offset` parameter
- Fix: Use cursor-based pagination with post ID + timestamp
