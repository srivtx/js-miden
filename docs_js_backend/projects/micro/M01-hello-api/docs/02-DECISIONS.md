# 02 — DECISIONS: Architecture Choices with Alternatives

Every decision below follows the format:

> **Option A** | **Option B** | **Chosen** | **Why** | **What if we're wrong?**

---

## Decision 1: Logger Library

**Option A: Winston**
- The most popular Node logger for years (3M+ weekly downloads).
- Highly configurable transports: console, file, HTTP, MongoDB.
- Mature ecosystem with many plugins.

**Option B: Pino**
- Benchmarked as the fastest Node logger (see 07-RESEARCH.md).
- Zero overhead in production: JSON serialization is the hot path, no interpolation.
- Native redaction of sensitive fields.
- Child loggers for cheap contextual logging.

**Chosen: Pino**

**Why:** In a high-throughput API, logging overhead directly translates to latency and CPU cost. Winston's flexibility comes with object allocation and formatter overhead. Pino's philosophy is "do one thing and do it fast": log JSON to stdout, let something else ship it.

**What if we're wrong?**
- If we later need to write logs directly to a file (not stdout), Pino supports `pino.destination()` but it's less ergonomic than Winston's transport pipeline.
- If we need exotic transports (Slack alerts, MongoDB), we'd have to add a log shipper (Fluent Bit, Vector) instead of configuring it in-app. This is actually the better architecture (separation of concerns), but it's more moving parts.

---

## Decision 2: Timing Strategy

**Option A: Wrap Every Handler Manually**

```ts
app.get('/', (req, res) => {
  const start = Date.now();
  res.send('Hello');
  logger.info({ durationMs: Date.now() - start, ... });
});
```

- Explicit and obvious.
- Easy to add custom per-route fields.

**Option B: Middleware + `res.on('finish')`**

```ts
app.use(requestLogger(logger));
app.get('/', (req, res) => res.send('Hello'));
```

- Non-invasive: route handlers stay clean.
- Catches ALL routes, including 404s and errors handled by Express.
- Measures true response time (socket flush), not just handler execution.

**Chosen: Option B**

**Why:** Separation of concerns. Route handlers should handle business logic. Observability should be a cross-cutting concern injected via middleware. Also, manual wrapping is guaranteed to be forgotten on at least one route.

**What if we're wrong?**
- If we need per-route custom metrics (e.g., "time spent in database query"), the generic middleware can't capture that. We'd need to add a child logger to `req` and have handlers attach their own spans. This is the OpenTelemetry model, which is the future, but it's overkill for this project.

---

## Decision 3: Log Transport

**Option A: Write to File**

```ts
const logger = pino({ name: 'api' }, pino.destination('/var/log/app.log'));
```

- Files persist across restarts.
- Familiar to old-school sysadmins.

**Option B: Write to stdout only**

```ts
const logger = pino({ name: 'api' });
// stdout is the default destination
```

- Container-friendly: Docker/K8s captures stdout automatically.
- Follows 12-Factor App methodology (factor 11: logs as event streams).
- No file rotation logic needed in the app.

**Chosen: Option B**

**Why:** Modern deployments are containerized. The app should not know about the filesystem. A separate log shipper (Fluent Bit, Promtail, Datadog Agent) tails stdout and forwards to the aggregation backend. This is simpler and more robust.

**What if we're wrong?**
- If we deploy on a bare-metal VPS without a log shipper, we lose logs when the process restarts. We'd need to add `pino.destination()` and `logrotate` configuration. But this is a deployment problem, not an app problem. Fixing it in the app couples us to the filesystem.

---

## Decision 4: Module System

**Option A: CommonJS (`require` / `module.exports`)**

```js
const express = require('express');
module.exports = { createApp };
```

- Works in every Node version since 2009.
- Vast ecosystem of CJS packages.

**Option B: ESM (`import` / `export`)**

```ts
import express from 'express';
export function createApp() { ... }
```

- Native in Node 12+ (stable since 14).
- Top-level `await`.
- Tree-shaking support for smaller bundles.
- Aligns with browser JavaScript (one module system everywhere).
- Required by many modern packages (e.g., `node-fetch` v3+ is ESM-only).

**Chosen: ESM**

**Why:** In 2025, ESM is the default for new projects. Node.js documentation recommends ESM for new applications. TypeScript's `NodeNext` module resolution is built around ESM. Staying on CommonJS is technical debt.

**What if we're wrong?**
- Some older packages are CJS-only and require awkward `import pkg from 'cjs-pkg';` default imports.
- `__dirname` and `__filename` don't exist in ESM; you must use `import.meta.url` with `fileURLToPath`.
- Jest has historically had poor ESM support (we use Vitest instead, which is ESM-native).

---

## Decision 5: Test Framework

**Option A: Jest**

- Industry standard for years.
- Massive ecosystem (snapshots, coverage, mocking).

**Option B: Vitest**

- ESM-native; no configuration hacks needed.
- Uses Vite's transformation pipeline: extremely fast.
- Jest-compatible API (`describe`, `it`, `expect`).
- Native TypeScript support without `ts-jest`.

**Chosen: Vitest**

**Why:** Jest's ESM support requires experimental Node flags and complex configuration. Vitest works out of the box with ESM and TypeScript. The API is identical for our use case, so the learning curve is zero for anyone who knows Jest.

**What if we're wrong?**
- Vitest is younger; some advanced Jest features (custom matchers, complex mocking) have slightly different APIs. But for HTTP API testing with Supertest, there is no practical difference.

---

## Decision 6: App Factory Pattern

**Option A: Singleton App**

```ts
// app.ts
export const app = express();
app.get('/', ...);

// index.ts
import { app } from './app.js';
app.listen(3000);
```

- Simple. One app instance everywhere.

**Option B: Factory Function**

```ts
// app.ts
export function createApp() {
  const app = express();
  app.get('/', ...);
  return app;
}

// index.ts
import { createApp } from './app.js';
const app = createApp();
app.listen(3000);
```

- Tests can create isolated app instances.
- No shared mutable state between tests.
- Can inject different configurations per instance (different log levels, different DB connections).

**Chosen: Factory Function**

**Why:** Testing. If `app` is a singleton, every test mutates the same Express instance. One test adds a middleware, it affects all subsequent tests. Factories guarantee isolation.

**What if we're wrong?**
- Slightly more boilerplate. But the benefit of test isolation far outweighs one extra function call.

---

## Decision 7: Request ID Generation

**Option A: Use existing header if present**

```ts
const requestId = req.headers['x-request-id'] || randomUUID();
```

- Supports distributed tracing out of the box.
- If a client sends a request ID, we honor it.

**Option B: Always generate a new UUID**

```ts
const requestId = randomUUID();
```

- Simpler. No trust boundary issues (malicious client could send colliding IDs).
- Always a valid UUID format.

**Chosen: Option B for this project, Option A for production**

**Why:** This is a micro-project. We keep it simple. In a real microservices setup, you'd read `x-request-id` from headers to maintain trace context across service boundaries. But you'd also validate it (length limits, UUID format) to prevent log injection attacks.

**What if we're wrong?**
- If this service is behind an API gateway that generates request IDs, our logs won't correlate with the gateway's logs. We'd lose distributed traceability. The fix is a one-line change to read the header.
