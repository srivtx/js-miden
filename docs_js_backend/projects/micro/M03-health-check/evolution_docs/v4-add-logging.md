# v4-add-logging.md — "Something broke but I can't see what"

## The Bug

Your health check endpoint starts failing intermittently. The database connection pool is exhausted. But your health check returns 200 because it's cached. The real failures are invisible.

You check the server logs. There are no logs. You add `console.log`:

```ts
app.get('/health', async (_req, res) => {
  console.log('Checking health');
  const health = await checkHealth();
  console.log('Health result:', health);
  res.json(health);
});
```

Now you have:

```
Checking health
Health result: { status: 'healthy', checks: { database: 'ok', redis: 'ok' } }
Checking health
Health result: { status: 'healthy', checks: { database: 'ok', redis: 'ok' } }
```

But when it fails, `console.log` interleaves with other output. You can't tell which request failed or when. The cache hides the real problem. The database is actually down, but the cached response says "ok."

## The 3am Page, Redux

The ops team says: "Health check returned 503 at 2:47am. Why?" You check the terminal. The process was restarted. The logs are gone. You have no structured data. No request ID. No timestamp.

You add `console.log` to the database check:

```ts
async function checkDatabase() {
  console.log('Querying DB');
  await db.query('SELECT 1');
  console.log('DB ok');
}
```

But `console.log` mixes with other output. Two health checks run concurrently and their logs interleave. You can't trace a single check.

## Adding Pino Structured Logging

```bash
npm install pino
```

```ts
// src/middleware/logger.ts
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    (req as Request & { id: string }).id = requestId;

    const startTime = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;

      logger.info({
        requestId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        durationMs,
        timestamp: new Date().toISOString(),
      }, 'request completed');
    });

    next();
  };
}
```

```ts
// src/index.ts
import { createLogger } from 'pino';
import { requestLogger } from './middleware/logger.js';

export const app = express();

const logger = createLogger({
  name: 'health-check',
  level: process.env.LOG_LEVEL || 'info',
});

app.use(requestLogger(logger));

app.get('/health', async (_req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error({ error }, 'health check failed');
    res.status(503).json({
      status: 'unhealthy',
      checks: { database: 'unknown', redis: 'unknown' },
    });
  }
});
```

Now every health check is a JSON line:

```json
{
  "level": 30,
  "time": 1715123456789,
  "name": "health-check",
  "requestId": "abc-123",
  "method": "GET",
  "path": "/health",
  "statusCode": 503,
  "durationMs": 5200,
  "msg": "request completed"
}
```

And errors:

```json
{
  "level": 50,
  "time": 1715123456790,
  "name": "health-check",
  "requestId": "abc-123",
  "error": { "message": "connect ECONNREFUSED 127.0.0.1:5432" },
  "msg": "health check failed"
}
```

## Why Pino?

- **JSON** is parseable by Datadog, Splunk, ELK, CloudWatch
- **Request IDs** let you trace a single request across services
- **Log levels** let you filter noise in production
- **Error serialization** captures stack traces automatically

## Querying in Production

```bash
# Health checks that took > 5 seconds (indicates DB timeout)
docker logs api | jq 'select(.path == "/health" and .durationMs > 5000)'

# Count 503s per hour
docker logs api | jq -s '
  map(select(.statusCode == 503))
  | group_by(.time / 3600000 | floor)
  | map({ hour: .[0].time, count: length })
'
```

## What Changed

- Added Pino for structured logging
- Every request gets a `requestId`
- Errors are logged with full context
- Response times expose slow dependency checks
- `LOG_LEVEL` env var controls verbosity

## What We Still Need

Logging tells us what broke after the fact. But when we refactor `checkHealth` to add caching, we might accidentally break the database check. We need to catch that before deploy.

For that, we need tests.
