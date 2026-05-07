# v4-add-logging.md — Query Param Parser

## The Pain

In production, bad requests came in but we had no visibility:

```typescript
app.get('/search', (req, res) => {
  const parse = searchSchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  // ...
});
```

1. Someone probing with `page=-1`? We returned 400, but had no record.
2. A scanner sending XSS payloads? The request was rejected, but security had no alerts.
3. Performance degraded at 2 PM? No request timing data to correlate.

`console.log` existed in dev, but in production it was swallowed by systemd or Docker.

## The Fix: Add Structured Request Logging

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'query-parser' },
});
```

```typescript
// middleware/requestLogger.ts
import { logger } from '../logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      query: req.query,
      status: res.statusCode,
      duration: Date.now() - start,
    }, 'Request completed');
  });
  next();
}
```

Now logs look like:
```json
{"level":30,"time":1715000000000,"service":"query-parser","method":"GET","path":"/search","query":{"page":"-1","limit":"10"},"status":400,"duration":3,"msg":"Request completed"}
```

Security teams can now alert on:
- High rate of 400s from a single IP
- XSS patterns in `query` parameter
- Unusual `limit` values

## But Logging Doesn't Fix XSS

We still reflect user input into HTML without escaping. Logging shows us the attacks, but the application is still vulnerable. We need output sanitization (see v7).

> **Lesson:** Structured logging enables security monitoring and performance analysis. But it doesn't replace input sanitization.
