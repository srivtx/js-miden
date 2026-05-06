# v4-add-logging.md — Request Logger

## The Pain

We added redaction (v3), but `console.log` was still our transport:

```typescript
res.on('finish', () => {
  const entry: LogEntry = {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: Date.now() - start,
    userAgent: req.headers['user-agent'],
    body: redact(req.body),
  };
  console.log(JSON.stringify(entry));
});
```

1. **`console.log` is synchronous** — under load, each request blocks the event loop while writing to stdout.
2. **No log levels** — everything is "info." We can't filter out health checks.
3. **No timestamps** — `console.log` doesn't include them by default in all environments.
4. **No request IDs** — when a user reports a bug, we can't trace their specific request through the logs.

## The Fix: Add Structured JSON Logging

```typescript
// logger.ts
import pino from 'pino';
import { randomUUID } from 'crypto';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'request-logger' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

```typescript
// middleware/logger.ts
import { logger } from '../logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  req.id = req.headers['x-request-id'] || randomUUID();

  res.on('finish', () => {
    logger.info({
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      userAgent: req.headers['user-agent'],
      body: redact(req.body),
    }, 'Request completed');
  });

  next();
}
```

Now logs look like:
```json
{"level":30,"time":"2024-05-06T14:32:01.123Z","service":"request-logger","requestId":"a1b2c3d4","method":"POST","path":"/login","status":200,"duration":12,"userAgent":"Mozilla/5.0","body":{"username":"admin","password":"[REDACTED]"},"msg":"Request completed"}
```

## But Structured JSON Logging Doesn't Fix Async I/O

`pino` with default settings still writes synchronously. For true production scale, we need async destinations (`pino.destination({ sync: false })`). And we haven't added tests to verify redaction works (see v5).

> **Lesson:** Structured JSON + request IDs make logs queryable and traceable. But high-throughput apps need async transports to avoid blocking the event loop.
