# Build & Run

## Prerequisites

- Node.js >= 20
- Docker & Docker Compose (optional)

## Local Development

```bash
cd A17-financial-ledger
npm install
npm run dev
```

Server starts on http://localhost:3000

## Running Tests

```bash
npm test
```

Tests cover:
- Account creation and balance tracking
- Double-entry transaction posting
- Floating-point precision bug reproduction
- Ledger integrity verification

## Docker

```bash
docker-compose up -d
```

Services:
- `app`: Express ledger API
- `postgres`: General ledger database
- `redis`: Session/caching
- `audit-backup`: Audit log archiving stub

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| DATABASE_URL | postgresql://ledger:ledger@localhost:5432/ledger | PostgreSQL |
| REDIS_URL | redis://localhost:6379 | Redis |
| AUDIT_LOG_PATH | ./data/audit | Audit file storage |
| DEFAULT_CURRENCY | USD | Base currency |

## Project Structure

```
src/
  index.ts              # Entry point
  config.ts             # Configuration
  routes/               # Routers (accounts, transactions, journal, reports)
  controllers/          # Request handlers
  services/             # Business logic
  middleware/           # Auth, validation, errors
  types/                # TypeScript interfaces
  utils/                # Money (bug), validators, logger
tests/                  # Vitest test suite
docs/                   # Documentation
```
