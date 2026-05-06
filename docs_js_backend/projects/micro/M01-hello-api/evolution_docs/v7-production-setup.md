# v7-production-setup.md — "The final version"

## The Journey

We started with 7 lines of JavaScript:

```js
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello, World!'));
app.listen(3000, () => console.log('Server listening'));
```

It worked. It also lied to us. Typos shipped silently. Logs were invisible. Changes broke things we didn't know about.

Here's what we added and why:

| Step | What we added | What bug it prevents |
|------|--------------|----------------------|
| v1 | Simple JS | None — this is where bugs live |
| v2 | TypeScript | `req.body.nmae` → caught at compile time |
| v3 | Zod validation | `{ age: "not-a-number" }` → 400 with clear errors |
| v4 | Pino logging | 3am mystery → searchable JSON logs |
| v5 | Vitest + Supertest | Adding auth breaks `/health` → caught in CI |
| v6 | ESM | `__dirname` hacks, no top-level await → gone |
| v7 | Production setup | Everything wired together, intentional bug to find |

## Final File Structure

```
M01-hello-api/
├── src/
│   ├── index.ts          # Entry point: create app, start server, graceful shutdown
│   ├── app.ts            # App factory: wire middleware and routes
│   └── middleware/
│       └── logger.ts     # Structured logging with Pino
├── tests/
│   └── app.test.ts       # Vitest + Supertest: endpoints, logs, duration bug
├── package.json          # ESM, scripts, dependencies
├── tsconfig.json         # strict, NodeNext module resolution
└── evolution_docs/       # This file and the journey
```

## Each File Explained

### `src/index.ts`

```ts
import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
```

- Uses ESM imports with `.js` extension
- `createApp()` factory lets us create fresh app instances in tests
- Graceful shutdown on `SIGTERM` — Kubernetes and Docker send this signal

### `src/app.ts`

```ts
import express from 'express';
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

- Factory pattern — tests call `createApp()` to get an isolated instance
- `requestLogger` is registered first so every route is logged
- Health check is simple — no DB, no Redis, just "am I running?"

### `src/middleware/logger.ts`

```ts
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';

export function requestLogger(logger: Logger) {
  const startTime = Date.now();  // <-- BUG IS HERE

  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    (req as Request & { id: string }).id = requestId;

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

- Structured JSON logs with requestId, method, path, statusCode, durationMs
- `res.on('finish')` ensures we log the final status after error handlers

## The Intentional Bug

`startTime` is captured once when `requestLogger()` is called, not once per request. This means `durationMs` measures the time since the middleware was created (server boot), not the actual request time.

The test `logs response time under 20ms for a fast handler` fails because of this. After waiting 50ms, the logged duration is >50ms even though the handler itself is instant.

**Fix:** Move `const startTime = Date.now();` inside the returned middleware function.

## Running It

```bash
# Install dependencies
npm install

# Run in development (TypeScript, no build step)
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Run compiled JavaScript
npm start
```

## Why This Matters

This isn't a tutorial about logging. It's a story about what happens when you don't have it. Every piece of complexity here was paid for in 3am pages, database migrations, and angry Slack threads.

TypeScript catches typos. Zod catches garbage. Pino catches mysteries. Tests catch regressions. ESM catches module headaches.

The bug in `logger.ts` is intentional. Find it. Fix it. That's the final lesson: even production code has bugs, and the only way to find them is to look.
