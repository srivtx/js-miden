# M01 Hello API with Structured Logging

> **Type:** Micro Project (30 minutes)  
> **Stack:** Express 5, TypeScript, ESM, Pino, Vitest  
> **Goal:** Build a simple API that greets the world and logs every request as structured JSON.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Run tests (one test is expected to fail because of the intentional bug)
npm test

# Build for production
npm run build
npm start
```

The server starts on `http://localhost:3000`.

Endpoints:
- `GET /` → `Hello, World!`
- `GET /health` → `{ "status": "ok" }`

---

## Project Structure

```
M01-hello-api/
├── README.md
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Entry point: creates app and starts HTTP server
│   ├── app.ts            # Express app factory (routes + middleware wiring)
│   └── middleware/
│       └── logger.ts     # Pino-based request logging middleware
└── tests/
    └── app.test.ts       # Vitest + Supertest suite (1 failing test = the bug)
```

---

## The Thinking Framework

### PHASE 1 — Problem

We need a simple API with one job: return "Hello, World!".
But production APIs aren't just about responses—they need **observability**.

**Requirements:**
1. Return `Hello, World!` on `GET /`.
2. Return a health-check JSON on `GET /health`.
3. Log **every** request with:
   - `timestamp` — when it happened
   - `method` — HTTP verb
   - `path` — URL path
   - `statusCode` — response status
   - `durationMs` — how long the request took
   - `requestId` — unique ID for tracing

The logs must be **structured JSON**, not plain strings, so log aggregation tools (Datadog, Splunk, Grafana Loki, AWS CloudWatch) can parse them automatically.

---

### PHASE 2 — Thinking

#### Why not `console.log`?

```js
// BAD: synchronous, blocks event loop, unstructured
console.log(`GET / 200 ${Date.now() - start}ms`);
```

- `console.log` writes synchronously to `stdout`. Under high load, this blocks the event loop and destroys throughput.
- Plain strings require regex parsing downstream. Brittle and slow.
- No built-in log levels (info, warn, error). Every message looks the same.

#### Why structured JSON?

```json
{
  "level": 30,
  "time": 1715000000000,
  "msg": "request completed",
  "method": "GET",
  "path": "/",
  "statusCode": 200,
  "durationMs": 2.4,
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

- Every field is queryable: `"statusCode":>500`, `"durationMs":>1000`.
- No regex needed. Fast to index.
- Standard format across all services in a microservices architecture.

#### How to measure response time?

HTTP is a pipeline:
1. Request arrives → start timer
2. Handler runs
3. Response headers sent
4. Response body fully written → `res` emits `'finish'`

The most accurate duration is from (1) to (4). We must hook into the `'finish'` event on the response object, because Express doesn't expose a post-response lifecycle hook natively.

#### Production reality

In production, Node apps run in containers. Logs go to `stdout`/`stderr`. A log shipper (Fluent Bit, Promtail, Datadog Agent) tails those streams and forwards them to a central system. The app itself should not know or care where logs end up.

---

### PHASE 3 — Decisions

| Decision | Option A | Option B | **Chosen** | Why |
|---|---|---|---|---|
| Logger | Winston | **Pino** | **Pino** | Fastest benchmarks; zero overhead in production; native JSON; built-in redaction |
| Timing strategy | Wrap handlers manually | **Middleware + `res.on('finish')`** | **Middleware** | Non-invasive; works for all routes automatically; captures final status code |
| Log transport | Write to file | **stdout** | **stdout** | 12-factor app principle; container-friendly |
| Module system | CommonJS | **ESM** | **ESM** | Native `import`/`export`; top-level await; tree-shaking |
| Test framework | Jest | **Vitest** | **Vitest** | Native ESM support; fast; Vite-based; Jest-compatible API |

**Key design points:**
- **App factory pattern:** `createApp()` returns an Express instance. This lets tests create isolated apps without starting a real server on a port.
- **Request ID injection:** Every log line carries a UUID so you can trace a single request through multiple log entries.
- **Graceful shutdown:** On `SIGTERM`, close the HTTP server so in-flight requests finish before the process exits.

---

### PHASE 4 — Code

#### `src/middleware/logger.ts`

The middleware uses a closure to capture the Pino logger instance, then returns the actual Express middleware function. It registers a one-time listener on `res`'s `'finish'` event so it can read the final `statusCode` and compute duration.

```ts
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startTime = Date.now();

    res.on('finish', () => {
      logger.info({
        requestId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startTime,
      }, 'request completed');
    });

    next();
  };
}
```

**Note:** The version in `src/middleware/logger.ts` intentionally contains a bug (see Phase 5). The snippet above shows the *correct* pattern.

#### `src/app.ts`

Wires the logger middleware first (so it catches all routes), then defines route handlers.

#### `src/index.ts`

Calls `createApp()`, starts listening on `PORT`, and attaches a `SIGTERM` handler for graceful shutdown.

#### `tests/app.test.ts`

Uses **Supertest** to make HTTP requests against the Express app without starting a real server. Uses an in-memory Pino stream to capture and assert on the exact JSON log output.

---

### PHASE 5 — The Bug

#### The Symptom

Run `npm test`:

```
FAIL  tests/app.test.ts > Hello API > logs response time under 20ms for a fast handler
AssertionError: expected 52 to be less than 20
```

The logged `durationMs` is ~50ms even though the handler itself is instantaneous.

#### The Root Cause

In `src/middleware/logger.ts`:

```ts
export function requestLogger(logger: Logger) {
  const startTime = Date.now();   // ← BUG: captured ONCE when middleware is CREATED

  return (req: Request, res: Response, next: NextFunction) => {
    // ...
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;  // ← measures time since CREATION, not request
      // ...
    });
  };
}
```

`startTime` is declared in the outer (factory) function scope. It is evaluated **once** when `requestLogger(logger)` is called (usually at server startup or test setup). Every subsequent request subtracts that same fixed value, so `durationMs` actually measures **how long the app has been running**, not how long the request took.

#### Why This Is Subtle

- If you test immediately after creating the app, the bug is invisible because the elapsed time is tiny.
- In production, response times look plausible at first but grow larger as the server uptime increases.
- It is a classic "closure scope" mistake: the variable is in the wrong scope.

#### The Fix

Move `startTime` inside the returned middleware so it is evaluated **per request**:

```ts
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();   // ← CORRECT: captured once PER REQUEST

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      // ...
    });

    next();
  };
}
```

#### How the Test Catches It

The failing test deliberately waits 50ms after creating the app, then makes a request:

```ts
await new Promise((r) => setTimeout(r, 50));
await request(app).get('/fast');
expect(duration).toBeLessThan(20);  // Fails: duration includes the 50ms idle time
```

This exposes the scoping bug because `durationMs` now includes the idle wait.

---

## Further Exercises

1. **Fix the bug:** Move `startTime` into the inner middleware function. Re-run tests—they should all pass.
2. **Add log redaction:** Configure Pino to redact `req.headers.authorization` so tokens never leak into logs.
3. **Add error logging:** Create an Express error-handling middleware that logs `500` errors with the stack trace.
4. **Add request body logging:** Log `req.body` for `POST` requests (be careful with sensitive data).
5. **Add a slow route:** Create `GET /slow` that waits 100ms. Assert that `durationMs` is `>= 100`.

---

## Key Takeaways

- **Always use structured JSON logging** in production APIs. Tools can parse it; humans can read it.
- **Never use `console.log`** for request logging in high-throughput services. Use a dedicated logger like Pino.
- **Be careful with closure scopes** in middleware factories. Variables captured in the outer scope are shared across all requests.
- **Test with time delays** to catch timing bugs that are invisible in instant tests.
