# M03 Health Check

A micro project demonstrating deep health checks with PostgreSQL and Redis.

## Problem

Build a `/health` endpoint that returns 200 if the app is healthy, 503 if not. Must check:
- App is running
- Database is reachable (can execute `SELECT 1`)
- Redis is reachable (can execute `PING`)

Must return details:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

## Decisions

- **Deep health check**: Verify DB and Redis, not just the app process
- **5-second timeout**: Per dependency check
- **Cache status for 5 seconds**: Don't hammer the database with health checks
- **Detailed JSON**: Return check details for debugging

## Intentional Bug

The health check in `src/health.ts` queries the database and Redis but **does not `await` the results**. This causes the endpoint to always return HTTP 200 immediately, even when dependencies are down.

The tests in `tests/health.test.ts` verify that the health check should fail (return 503) when the database is down. These tests **will fail** until the bug is fixed.

## Running

```bash
# Start dependencies
docker-compose up -d

# Install dependencies
npm install

# Run in development
npm run dev

# Run tests (some will fail due to the intentional bug)
npm test
```

## API

### GET /health

**200 OK** — When healthy:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**503 Service Unavailable** — When unhealthy (expected behavior after fixing the bug):
```json
{
  "status": "unhealthy",
  "checks": {
    "database": "error",
    "redis": "ok"
  }
}
```
