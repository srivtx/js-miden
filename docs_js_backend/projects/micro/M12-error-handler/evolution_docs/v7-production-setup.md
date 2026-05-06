# v7-production-setup.md — Error Handler

## Final Production Setup

After evolving through 6 versions, here's the production-ready setup connecting to `src/`:

### `src/middleware/errorHandler.ts` (Current — with intentional bugs for learning)
```typescript
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // BUG 1: Does not check res.headersSent.
  // If headers were already sent, res.status() crashes with ERR_HTTP_HEADERS_SENT.

  console.error('[Error]', err.message);

  const isAppError = err instanceof AppError;

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title: isAppError ? err.title : 'Internal Server Error',
    status: isAppError ? err.status : 500,
    detail: err.message,
    instance: req.originalUrl,
    // BUG 2: Exposes stack trace in all environments, including production.
    stack: err.stack,
  };

  res.status(problem.status).json(problem);
}
```

### `src/errors.ts`
```typescript
export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public type: string = 'about:blank'
  ) {
    super(detail);
    this.name = 'AppError';
  }
}
```

### What a Production Fix Looks Like

```typescript
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';

export function errorHandler(err, req, res, next) {
  // Prevent double-response crashes
  if (res.headersSent) {
    logger.error(err, 'Error after headers sent');
    return;
  }

  const errorId = randomUUID();
  const isAppError = err instanceof AppError;
  const isDev = process.env.NODE_ENV !== 'production';

  logger.error({
    errorId,
    err: { message: err.message, stack: err.stack, type: err.constructor.name },
    req: { method: req.method, url: req.originalUrl, ip: req.ip },
  }, 'Unhandled error');

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title: isAppError ? err.title : 'Internal Server Error',
    status: isAppError ? err.status : 500,
    detail: err.message,
    instance: req.originalUrl,
    errorId,
    ...(isDev && { stack: err.stack }),
  };

  res.status(problem.status).json(problem);
}
```

### Evolution Summary

| Version | Added | Bug Caught / Pain Solved |
|---------|-------|--------------------------|
| v1 | No handler | Process crashes on every error |
| v2 | TypeScript + AppError | Consistent error shapes, typed handlers |
| v3 | Runtime validation | Validates error objects before accessing props |
| v4 | Structured logging | Error IDs for support correlation |
| v5 | Tests | Documents stack leak, headersSent crash |
| v6 | ESM | Reliable `instanceof` across monorepo |
| v7 | Production (RFC 7807 + leak prevention) | Safe errors, no stack leak, no double-response crash |

### Key Takeaway

Error handling is the most critical middleware in any API. A broken error handler turns minor bugs into production outages. The two fatal bugs here (`stack` leak + `headersSent` crash) are invisible in development but catastrophic in production. The fix requires defensive checks (`headersSent`), environment awareness (`NODE_ENV`), and structured logging with error IDs.
