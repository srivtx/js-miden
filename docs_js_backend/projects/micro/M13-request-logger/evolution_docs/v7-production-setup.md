# v7-production-setup.md — Request Logger

## Final Production Setup

After evolving through 6 versions, here's the production-ready setup connecting to `src/`:

### `src/middleware/logger.ts` (Current — with intentional bug for learning)
```typescript
import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // BUG: Logs the entire request body without redacting sensitive fields.
    // Passwords and tokens end up in plain text in the logs.
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        body: req.body,
      })
    );
  });

  next();
}
```

### What a Production Fix Looks Like

```typescript
import type { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { randomUUID } from 'crypto';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))
      ? '[REDACTED]'
      : redact(value);
  }
  return clone;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
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

### Evolution Summary

| Version | Added | Bug Caught / Pain Solved |
|---------|-------|--------------------------|
| v1 | console.log in routes | Inconsistent, no structure, leaks passwords |
| v2 | TypeScript | Consistent LogEntry shape, catches typos |
| v3 | Runtime redaction | Passwords replaced with `[REDACTED]` |
| v4 | Structured JSON logging | Queryable, timestamped, with request IDs |
| v5 | Tests | Documents password leak; prevents regression |
| v6 | ESM | Uses Pino v9+, tree-shaking, async transports |
| v7 | Production (Pino + redaction) | Fast, async, safe, structured |

### Key Takeaway

Logging is a security boundary. A logger that leaks passwords is a data breach. The evolution from `console.log` to Pino + redaction reflects the shift from "debugging tool" to "production observability system." Every layer (types, validation, redaction, tests, ESM) was necessary because the previous layer couldn't guarantee both correctness and performance.
