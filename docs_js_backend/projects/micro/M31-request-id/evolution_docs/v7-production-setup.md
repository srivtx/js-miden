# M31 Request ID — v7 Production Setup

## The Journey

We started with no request IDs, layered in types, validation, logging, tests, and ESM. Now we have tracing that follows a request across every service it touches.

## What v7 Adds

- **UUID v4 generation**: Cryptographically random, globally unique
- **Incoming ID reuse**: Respects existing `X-Request-ID` from upstream
- **Downstream propagation**: Forwards the same ID to every downstream call
- **Error handler guarantee**: Ensures `X-Request-ID` is present even on 500 responses

## The Final Code

```ts
// src/requestId.ts
import { Request, Response, NextFunction } from 'express';

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.get('X-Request-ID') || generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

export function getRequestId(req: Request): string {
  return (req as any).requestId || 'unknown';
}
```

```ts
// src/logger.ts
export interface LogEntry {
  timestamp: string;
  level: string;
  requestId: string;
  message: string;
  meta?: Record<string, unknown>;
}

export function logWithRequestId(
  req: Request,
  level: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: getRequestId(req),
    message,
    meta,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (req: Request, message: string, meta?: Record<string, unknown>) =>
    logWithRequestId(req, 'INFO', message, meta),
  error: (req: Request, message: string, meta?: Record<string, unknown>) =>
    logWithRequestId(req, 'ERROR', message, meta),
};
```

```ts
// src/proxy.ts
export function proxyMiddleware(
  downstreamUrl: string
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const requestId = getRequestId(req);
      const headers = new Headers();
      headers.set('X-Request-ID', requestId);
      await fetch(downstreamUrl, { headers });
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

```ts
// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from './requestId.js';
import { logger } from './logger.js';
import { proxyMiddleware } from './proxy.js';

const app = express();

app.use(requestIdMiddleware);

app.get('/health', (req: Request, res: Response) => {
  logger.info(req, 'health check');
  res.json({ status: 'ok' });
});

app.get('/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(req, 'fetching data');
    res.json({ data: [1, 2, 3] });
  } catch (err) {
    logger.error(req, 'data error');
    next(err);
  }
});

app.get('/proxy', proxyMiddleware('http://example.com/api'), (req: Request, res: Response) => {
  logger.info(req, 'proxy response');
  res.json({ proxied: true });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: err.message });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M31 listening on :3000'));
}
```

## Why This Matters in Production

Without request IDs, a single user transaction that touches 5 services generates 5 unrelated log streams. Debugging requires grepping by timestamp and IP address, which is approximate and noisy. With correlation IDs, you filter by one UUID and see the entire journey.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | No request IDs, interleaved logs | Generate IDs per request |
| v2 | Typos break middleware silently | TypeScript interfaces |
| v3 | Malformed IDs propagate | Runtime validation |
| v4 | IDs exist but aren't logged | Structured logging |
| v5 | Error responses lose headers | Jest tests for header presence |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | IDs don't cross service boundaries | Downstream propagation with UUID |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
