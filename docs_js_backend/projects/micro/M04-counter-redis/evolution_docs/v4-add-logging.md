# v4-add-logging.md — "Something broke but I can't see what"

## The Bug

Your counter API starts returning 503: "Redis unavailable." You check Redis — it's running. You check the network — it's fine. You have no logs.

You add `console.log`:

```ts
app.post('/increment', async (_req, res) => {
  console.log('Incrementing');
  try {
    const count = await increment();
    console.log('New count:', count);
    res.json({ count });
  } catch (err) {
    console.log('Error:', err);
    res.status(503).json({ error: 'Redis unavailable' });
  }
});
```

The log file fills up:

```
Incrementing
Error: Error: Connection timeout
Incrementing
New count: 42
Incrementing
Error: Error: Connection timeout
```

Which request failed? When? How long did it take? Was it a timeout or a refused connection? You can't tell. Two requests interleave. You add `Date.now()` manually and forget in half the handlers.

## The 3am Page, Redux

You get paged: "Counter is stuck at 0." You check Redis. The key is `"NaN"`. You have no log of how `"NaN"` got there. Maybe a bad request? Maybe a race condition? Maybe someone manually set it?

Without structured logs, debugging distributed state is archaeology.

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

const app = express();
const logger = createLogger({
  name: 'counter-api',
  level: process.env.LOG_LEVEL || 'info',
});

app.use(requestLogger(logger));

app.post('/increment', async (_req, res) => {
  try {
    const count = await increment();
    logger.info({ count }, 'counter incremented');
    res.json({ count });
  } catch (err) {
    logger.error({ err }, 'increment failed');
    res.status(503).json({ error: 'Redis unavailable' });
  }
});
```

Now:

```json
{
  "level": 30,
  "time": 1715123456789,
  "name": "counter-api",
  "requestId": "abc-123",
  "method": "POST",
  "path": "/increment",
  "statusCode": 200,
  "durationMs": 15,
  "msg": "request completed"
}
```

And:

```json
{
  "level": 50,
  "time": 1715123456790,
  "name": "counter-api",
  "requestId": "abc-123",
  "err": {
    "type": "Error",
    "message": "Connection timeout",
    "stack": "..."
  },
  "msg": "increment failed"
}
```

## Why Pino?

- **JSON** is machine-parseable
- **Error serialization** includes the full stack trace
- **Child loggers** carry context (requestId) across async boundaries
- **Async writes** don't slow down Redis operations

## Querying in Production

```bash
# Find all Redis failures
docker logs api | jq 'select(.msg == "increment failed")'

# Count 503s per minute
docker logs api | jq -s '
  map(select(.statusCode == 503))
  | group_by(.time / 60000 | floor)
  | map({ minute: .[0].time, count: length })
'

# Find the request that caused count to become NaN
docker logs api | jq 'select(.count == "NaN")'
```

## What Changed

- Added Pino for structured logging
- Every request gets a `requestId`
- Errors include full stack traces
- Counter values are logged for auditability
- Response times expose Redis latency

## What We Still Need

Logging shows us problems after they happen. But when we switch from `get/set` to `INCR` for atomicity, we might accidentally break the `getCount` endpoint. We need to catch that before deploy.

For that, we need tests.
