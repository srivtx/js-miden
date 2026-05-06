# S15: Webhook Sender

Register webhook URLs and send POST requests with exponential backoff, retries, and delivery logging.

## Features

- **Phase 1**: Register webhooks, send events, retry with exponential backoff, log attempts
- **Phase 2-3**: Delivery guarantees (at-least-once), retry schedules, circuit breaker pattern, payload signing
- **Intentional Bugs**:
  - Missing retry on failure (not present in correct path, documented for awareness)
  - Missing timeout (documented in sender service comments)
  - Missing signature (documented in comparison routes)

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:up
npm run dev
```

## Testing

```bash
npm test
```

## Project Structure

```
src/
  index.ts              # Entry point
  app.ts                # Express app setup
  db.ts                 # PostgreSQL connection & migrations
  routes/
    webhooks.ts         # Webhook & event routes
  services/
    sender.ts           # Delivery logic with retries
  utils/
    signature.ts        # HMAC payload signing
  types.ts              # Shared types
tests/
  webhooks.test.ts      # Vitest + Supertest suite
docs/
  01-overview.md
  ...
```
