# v4-add-logging.md — Error Handler

## The Pain

In production, errors were either invisible or dangerously exposed:

```typescript
export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  const problem = {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: err.message,
    instance: req.originalUrl,
    stack: err.stack,  // LEAKED to client
  };

  res.status(500).json(problem);
}
```

1. `console.error` writes to stderr, but in Docker it might be lost or mixed with other output.
2. `err.stack` is sent to **every client**, including attackers. It leaks:
   - File paths (`/app/src/routes.ts:15`)
   - Dependency versions (`node_modules/express@5.0.0`)
   - Internal logic (`SELECT * FROM users WHERE id = ...`)
3. No error ID — when a user reports "I got an error," we can't find it in logs.

## The Fix: Add Production-Safe Logging

```typescript
// logger.ts
import pino from 'pino';
import { randomUUID } from 'crypto';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'error-handler' },
});
```

```typescript
// middleware/errorHandler.ts
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    logger.error(err, 'Error after headers sent');
    return;
  }

  const errorId = randomUUID();
  const isDev = process.env.NODE_ENV !== 'production';

  logger.error({
    errorId,
    err: {
      message: err.message,
      stack: err.stack,
      type: err.constructor.name,
    },
    req: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    },
  }, 'Unhandled error');

  const problem = {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: err.message,
    instance: req.originalUrl,
    errorId,
    ...(isDev && { stack: err.stack }),  // only in dev
  };

  res.status(500).json(problem);
}
```

Now:
- `stack` is **only** included when `NODE_ENV !== 'production'`
- Every error gets a UUID for support ticket correlation
- Structured logs contain the full stack for internal debugging

## But Logging Doesn't Fix Double-Response Crashes

If `res.headersSent` is true, we log and return. But if we forget that check, the process still crashes. Logging is additive; `headersSent` check is defensive.

> **Lesson:** Production logging must be structured, include error IDs, and never leak stacks. But it doesn't replace defensive checks against double responses.
