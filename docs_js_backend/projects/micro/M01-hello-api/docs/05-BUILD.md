# 05 — BUILD: Step-by-Step from Empty Folder

This guide assumes an empty folder and takes you to a fully working, tested project. No steps skipped. No magic.

---

## Step 0: Prerequisites

You need Node.js 20+ and npm 10+ installed.

```bash
node --version  # v20.x.x or higher
npm --version   # 10.x.x or higher
```

---

## Step 1: Initialize the Project

```bash
mkdir M01-hello-api
cd M01-hello-api
npm init -y
```

The `-y` flag accepts all defaults. This creates `package.json`.

---

## Step 2: Configure ESM

Edit `package.json` to add `"type": "module"`. This tells Node.js to treat every `.js` file as ESM.

```json
{
  "name": "m01-hello-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {},
  "dependencies": {},
  "devDependencies": {}
}
```

**Why:** Without this, Node.js assumes CommonJS. Your `import` statements would throw `SyntaxError: Cannot use import statement outside a module`.

---

## Step 3: Install Dependencies

```bash
npm install express@5 pino@9
npm install -D typescript@5 @types/node@22 @types/express@5 tsx@4 vitest@3 supertest@7 @types/supertest@6
```

**What each package does:**

| Package | Role |
|---------|------|
| `express` | HTTP framework. `express()` creates an app; `app.get()` registers routes; `app.use()` registers middleware. |
| `pino` | Structured logger. `pino()` creates a logger instance; `logger.info(obj, msg)` writes JSON. |
| `typescript` | TypeScript compiler. `tsc` transpiles `.ts` to `.js`. |
| `@types/node` | Type declarations for Node.js built-ins (`process`, `crypto`, `http`). |
| `@types/express` | Type declarations for Express (`Request`, `Response`, `NextFunction`). |
| `tsx` | TypeScript executor. `tsx src/index.ts` runs TypeScript directly without pre-compilation. Faster than `ts-node` for development. |
| `vitest` | Test runner. Provides `describe`, `it`, `expect`, plus ESM-native execution. |
| `supertest` | HTTP assertion library. `request(app).get('/')` makes requests against Express without starting a real server. |
| `@types/supertest` | Type declarations for Supertest. |

---

## Step 4: Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Field-by-field explanation:**

| Field | Meaning |
|-------|---------|
| `target: ES2022` | Compile to JavaScript that uses ES2022 features (e.g., top-level await). |
| `module: NodeNext` | Use Node.js's ESM resolution algorithm. Required for ESM projects. |
| `moduleResolution: NodeNext` | Look up imports using Node.js ESM rules (mandatory `.js` extensions in imports). |
| `outDir: ./dist` | Compiled `.js` files go here. |
| `rootDir: ./src` | TypeScript treats `src/` as the project root for output path mapping. |
| `strict: true` | Enables all strict type-checking options. Catches more bugs. |
| `esModuleInterop: true` | Allows default imports from CJS packages (e.g., `import express from 'express'`). |
| `skipLibCheck: true` | Skips type checking of `node_modules/**/*.d.ts`. Speeds up compilation. |
| `declaration: true` | Emits `.d.ts` files alongside `.js`. Consumers of your library get types. |
| `sourceMap: true` | Emits `.js.map` files. Debuggers can map compiled code back to TypeScript source. |

---

## Step 5: Create the Logger Middleware

Create `src/middleware/logger.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';

/**
 * Express middleware factory that logs every HTTP request as structured JSON.
 *
 * Why a factory? So we can inject a specific logger instance (e.g., a test logger
 * that writes to an in-memory array instead of stdout).
 */
export function requestLogger(logger: Logger) {
  // NOTE: In the bug version, startTime is here (outer scope).
  // The correct version moves it inside the returned function.
  const startTime = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();

    // Attach requestId to req for potential downstream use
    (req as Request & { id: string }).id = requestId;

    // Wait until response is fully sent to socket
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

    next(); // Pass control to next middleware / route handler
  };
}
```

**Every import explained:**

- `import type { Request, Response, NextFunction } from 'express'`
  - `type` keyword: imports only the TypeScript types, not runtime code. Erased at compile time.
  - `Request`: represents the incoming HTTP request. Has `req.method`, `req.url`, `req.headers`, etc.
  - `Response`: represents the outgoing HTTP response. Has `res.send()`, `res.status()`, `res.on()`.
  - `NextFunction`: the callback you call to pass control to the next middleware.

- `import type { Logger } from 'pino'`
  - `Logger`: the interface for a Pino instance. Has `.info()`, `.warn()`, `.error()`, etc.

- `import { randomUUID } from 'node:crypto'`
  - `node:` prefix: explicitly indicates a Node.js built-in module. Recommended in modern Node.
  - `randomUUID()`: generates a UUID v4 string like `550e8400-e29b-41d4-a716-446655440000`.

**Every function explained:**

- `requestLogger(logger)`:
  - A **factory function**. It takes a logger and returns the actual middleware.
  - Why a factory? Tests can pass a custom logger. The main app passes a stdout logger.

- `return (req, res, next) => { ... }`:
  - The actual Express middleware. Called once per request.

- `res.on('finish', ...)`:
  - Registers an event listener on the response stream.
  - `'finish'` fires after the last byte is written to the network socket.
  - This is where we compute duration and write the log.

- `next()`:
  - Without this, the request hangs. Express waits for the next middleware forever.

---

## Step 6: Create the Express App Factory

Create `src/app.ts`:

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

  // Register structured logging middleware FIRST
  // so it wraps all subsequent route handlers
  app.use(requestLogger(logger));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Main endpoint
  app.get('/', (_req, res) => {
    res.send('Hello, World!');
  });

  return app;
}
```

**Every import explained:**

- `import express from 'express'`
  - Imports the default export from Express. `express` is a function that creates an app instance.
  - The `.js` extension is required in ESM imports, even though the source file is `.ts`. TypeScript resolves it.

- `import { createLogger } from 'pino'`
  - Named import. `createLogger(options)` returns a new Pino instance.

- `import { requestLogger } from './middleware/logger.js'`
  - Imports our factory function. Note the `.js` extension.

**Every function explained:**

- `createApp()`:
  - Returns a fresh Express instance. No side effects. No global state.
  - Tests call this to get isolated apps. `index.ts` calls this to get the production app.

- `createLogger({ name, level })`:
  - `name`: identifies the service in aggregated logs.
  - `level`: minimum severity to log. `info` logs `info`, `warn`, `error`. It does NOT log `debug`.

- `app.use(requestLogger(logger))`:
  - Registers our middleware globally. Every request runs through it.
  - Order matters. Middleware registered first runs first. If we put this after routes, it would never execute (routes terminate the chain).

- `app.get('/health', ...)`:
  - Route handler. `_req` means "I don't use this parameter." The underscore tells linters not to warn about unused variables.
  - `res.json()` sends JSON with `Content-Type: application/json`.

- `res.send()`:
  - Sends a plain text response. Express infers `Content-Type: text/html` for strings.

---

## Step 7: Create the Entry Point

Create `src/index.ts`:

```ts
import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

const app = createApp();

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
```

**Every line explained:**

- `const PORT = process.env.PORT || 3000;`
  - Reads the `PORT` environment variable. Falls back to 3000.
  - Why env var? In production (Heroku, Railway, AWS), the platform assigns a port. Hardcoding breaks deployment.

- `const server = app.listen(PORT, callback);`
  - `app.listen()` starts an HTTP server on the given port.
  - It returns a `http.Server` instance. We capture it so we can call `server.close()` during shutdown.

- `process.on('SIGTERM', ...)`
  - `SIGTERM` is the signal Docker/Kubernetes sends to ask a container to shut down.
  - `server.close()` stops accepting new connections but lets in-flight requests finish.
  - `process.exit(0)` exits cleanly. `0` means success.

- `console.log` in `index.ts`:
  - We use `console.log` here intentionally. Bootstrap messages ("Server started") happen once at startup. They are not on the hot path. Pino is overkill for one-off messages.

---

## Step 8: Create Tests

Create `tests/app.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { requestLogger } from '../src/middleware/logger.js';

/**
 * Creates a Pino logger that writes JSON into an in-memory array.
 * This lets us assert on the exact log output without parsing stdout.
 */
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

  // BUG REPRODUCTION TEST (see 06-BUGS.md)
  it('logs response time under 20ms for a fast handler', async () => {
    const { logger, logs } = createTestLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.get('/fast', (_req, res) => res.send('ok'));

    await new Promise((r) => setTimeout(r, 50));
    await request(app).get('/fast');

    expect(logs).toHaveLength(1);
    const duration = logs[0].durationMs as number;
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(20);
  });
});
```

**Every import explained:**

- `import { describe, it, expect } from 'vitest'`
  - Vitest's test DSL. Identical to Jest's API.

- `import request from 'supertest'`
  - Default import. `request(app)` returns a chainable HTTP client.

- `import { pino } from 'pino'`
  - Named import. `pino(level, stream)` creates a logger with a custom writable stream.

**Every function explained:**

- `createTestLogger()`:
  - Returns a Pino logger that writes to an in-memory array instead of stdout.
  - `stream.write` receives a JSON string. We `JSON.parse` it so tests can assert on objects.
  - This pattern is called **dependency injection**: we inject a test double (the memory stream) in place of the real dependency (stdout).

- `request(app).get('/').send()`:
  - Supertest simulates an HTTP request against the Express app.
  - No actual network call. No port binding. Fast and deterministic.

- `expect(res.status).toBe(200)`:
  - Vitest assertion. If `res.status` is not `200`, the test fails with a clear message.

---

## Step 9: Add npm Scripts

Edit `package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Runs `src/index.ts` directly with `tsx`. No compilation step. Fast feedback loop. |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm start` | Runs the compiled `dist/index.js` with Node. |
| `npm test` | Runs Vitest once and exits. Used in CI. |
| `npm run test:watch` | Runs Vitest in watch mode. Re-runs tests on file changes. |

---

## Step 10: Run It

```bash
# Development
npm run dev
# → Server listening on port 3000

# In another terminal:
curl http://localhost:3000/
# → Hello, World!

curl http://localhost:3000/health
# → {"status":"ok"}

# Tests (one will fail — that's the intentional bug)
npm test

# Build for production
npm run build
npm start
```

You now have a fully working, tested, structured-logging API.
