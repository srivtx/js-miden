# v4-add-logging.md — "Something broke but I can't see what"

## The Bug

It's 3am. Your phone rings. The frontend team says API requests are slow. You SSH into the server and check the terminal where you ran `node server.js`.

Nothing. The process was started with `nohup` and stdout went to a file. You `tail -f nohup.out`:

```
Server listening on port 3000
Got a request
Got a request
Got a request
Error: connect ECONNREFUSED 127.0.0.1:5432
Got a request
```

Which request caused the error? When? From which IP? How long did it take? You have no idea. `console.log` gave you "Got a request" 47 times and one error with no context.

You add more logs:

```ts
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
```

Now your log file is a mess of interleaved lines. Two requests come in at the same millisecond and their logs merge. You can't grep for a single request. You can't aggregate response times. You can't trace a user complaint from "it was slow at 2:47am" to the actual request.

## The 3am Page, Redux

A user reports they got a 500 on `/health`. You check the logs. There's no request ID. No timestamp. No method. No status code. Just:

```
Error: Cannot read properties of undefined (reading 'status')
```

Which request? Which handler? When? You add `console.log` to every handler. The problem moves. You never find the root cause.

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
// src/app.ts
import { createLogger } from 'pino';
import { requestLogger } from './middleware/logger.js';

export function createApp() {
  const app = express();

  const logger = createLogger({
    name: 'hello-api',
    level: process.env.LOG_LEVEL || 'info',
  });

  app.use(requestLogger(logger));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/', (_req, res) => {
    res.send('Hello, World!');
  });

  return app;
}
```

Now every request produces a single JSON line:

```json
{
  "level": 30,
  "time": 1715123456789,
  "pid": 12345,
  "hostname": "api-01",
  "name": "hello-api",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "GET",
  "path": "/health",
  "statusCode": 200,
  "durationMs": 12,
  "timestamp": "2025-05-08T02:30:56.789Z",
  "msg": "request completed"
}
```

## Why Pino?

- **Zero overhead in production:** Pino writes asynchronously. It doesn't block the event loop.
- **Structured JSON:** Datadog, Splunk, ELK, CloudWatch — they all parse JSON natively.
- **Log levels:** `trace`, `debug`, `info`, `warn`, `error`. Set `LOG_LEVEL=warn` in production to reduce noise.
- **Child loggers:** You can attach context (userId, requestId) and it merges into every log line.

## Querying in Production

With structured logs, you can ask real questions:

```bash
# Find all 500s in the last hour
jq 'select(.statusCode == 500)' logs.json | head -20

# Average response time for /health
docker logs api-01 | jq -s 'map(select(.path == "/health").durationMs) | add / length'

# All requests slower than 1 second
jq 'select(.durationMs > 1000)' logs.json

# Trace a specific request
jq 'select(.requestId == "a1b2c3d4-...")' logs.json
```

Try doing that with `console.log('Got a request')`.

## What Changed

- Added Pino dependency
- `requestLogger` middleware creates a `requestId` for every request
- Logs JSON with method, path, statusCode, durationMs, timestamp
- `res.on('finish')` ensures we log the final status (after error handlers)
- `LOG_LEVEL` env var controls verbosity

## What We Still Need

Logging gives us visibility. But it doesn't prevent regressions. When we add a new feature — say, auth on the `/greet` endpoint — we might accidentally break `/health`. We won't know until a user complains or we see 500s in the logs.

We need to catch breakage *before* deploy.

For that, we need tests.
