# v5-add-testing.md — "I broke the health endpoint adding auth"

## The Bug

You add authentication to the `/greet` endpoint. While you're at it, you refactor the middleware stack:

```ts
export function createApp() {
  const app = express();
  const logger = createLogger({ name: 'hello-api', level: 'info' });

  // You move auth middleware before the request logger
  app.use(authMiddleware);
  app.use(requestLogger(logger));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ...
}
```

The auth middleware rejects requests without a token. The load balancer's health check doesn't send a token. `/health` starts returning 401. The load balancer marks the server unhealthy. Traffic drops to zero.

You don't notice until your error budget alert fires. You didn't test `/health` after adding auth. It worked before. You assumed it still worked.

## The 3am Page, Redux

You fix the auth issue by exempting `/health`:

```ts
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  authMiddleware(req, res, next);
});
```

But now the request logger doesn't run for `/health`. You lose visibility into health check frequency and duration. The ops dashboard shows "no requests" even though the load balancer is hammering `/health` every 5 seconds.

You didn't test the logger. You tested the endpoint in your browser and it returned 200. You didn't check if the log line was emitted.

## Adding Vitest + Supertest

```bash
npm install -D vitest supertest @types/supertest
```

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { requestLogger } from '../src/middleware/logger.js';

function createTestLogger() {
  const logs: Record<string, unknown>[] = [];
  const stream = {
    write: (msg: string) => {
      logs.push(JSON.parse(msg));
    },
  };
  return { logger: pino({ level: 'info' }, stream), logs };
}

describe('Hello API', () => {
  it('GET / returns "Hello, World!"', async () => {
    const app = createApp();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello, World!');
  });

  it('GET /health returns status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('logs every request with structured fields', async () => {
    const { logger, logs } = createTestLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.get('/test', (_req, res) => res.status(201).send('created'));

    await request(app).get('/test');

    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).toHaveProperty('requestId');
    expect(log).toHaveProperty('method', 'GET');
    expect(log).toHaveProperty('path', '/test');
    expect(log).toHaveProperty('statusCode', 201);
    expect(log).toHaveProperty('durationMs');
    expect(log).toHaveProperty('timestamp');
  });

  it('logs response time under 20ms for a fast handler', async () => {
    const { logger, logs } = createTestLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.get('/fast', (_req, res) => res.send('ok'));

    await request(app).get('/fast');

    expect(logs).toHaveLength(1);
    const duration = logs[0].durationMs as number;
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(20);
  });
});
```

Run the tests:

```bash
npm test
```

The last test fails:

```
expected 57 to be less than 20
```

The logger captures `startTime` when the middleware factory runs, not when each request starts. The duration includes idle time. The test caught the bug before it reached production.

## Why Tests?

- **They document behavior.** A test says "`/health` must return 200 and `{ status: 'ok' }`". Documentation can lie. Tests can't.
- **They catch regressions.** Add auth → run tests → see `/health` break → fix before deploy.
- **They let you refactor.** Change the logger implementation? Tests verify the output is still correct.
- **They run in CI.** Every PR runs tests. Broken code never merges.

## What Changed

- Added Vitest and Supertest as dev dependencies
- Tests cover all endpoints (status, body, headers)
- Tests verify structured logging output
- Tests catch the duration bug in the logger
- `npm test` runs in CI before deploy

## What We Still Need

Tests verify behavior. But our imports are a mess — `require` and `module.exports` everywhere. Node.js 20+ prefers ESM. CommonJS is legacy. We need to modernize our module system.

For that, we need to switch to ESM.
