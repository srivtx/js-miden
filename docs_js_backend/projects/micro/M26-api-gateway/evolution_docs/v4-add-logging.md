# v4: Add Logging — API Gateway

## The Pain

A user reports: "My request to `/users/profile` returned a 502." You check the backend. It's healthy. You check the gateway. No logs. You don't know if the request even reached the gateway, which backend it was routed to, or what the backend response was.

You have three services, one gateway, and zero visibility. You are flying blind.

## The Solution

Add structured request logging middleware.

## Before (No Logs)

```typescript
// src/index.ts
import express from 'express';
import { createProxyMiddleware } from './gateway.js';

const app = express();
app.use(express.json());
app.use('/users', createProxyMiddleware('http://localhost:3001'));
app.use('/orders', createProxyMiddleware('http://localhost:3002'));
```

## After (With Logging)

```typescript
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```typescript
// src/logger.ts (middleware)
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId,
    }, 'Request completed');
  });

  next();
}
```

```typescript
// src/index.ts
import express from 'express';
import { createProxyMiddleware } from './gateway.js';
import { requestLogger } from './logger.js';

const app = express();
app.use(express.json());
app.use(requestLogger);
app.use('/users', createProxyMiddleware('http://localhost:3001'));
app.use('/orders', createProxyMiddleware('http://localhost:3002'));
```

## What the Logs Look Like

```json
{"level":30,"time":1715200000000,"method":"GET","path":"/users/profile","statusCode":200,"durationMs":45,"requestId":"abc-123","msg":"Request completed"}
{"level":30,"time":1715200001000,"method":"GET","path":"/users/profile","statusCode":502,"durationMs":5100,"requestId":"def-456","msg":"Request completed"}
{"level":30,"time":1715200002000,"method":"POST","path":"/orders","statusCode":504,"durationMs":5001,"requestId":"ghi-789","msg":"Request completed"}
```

## Why Logging Matters

- **Latency detection**: `durationMs: 5100` on a 502 tells you the backend timed out
- **Error correlation**: `requestId` lets you trace a single request across all services
- **Traffic analysis**: Log volume per path reveals hot endpoints
- **Alerting**: `statusCode >= 500` can trigger PagerDuty automatically

Without logs, a 502 is a mystery. With logs, you see the exact backend, the exact timing, and the exact failure mode.
