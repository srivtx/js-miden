# 03 — CONCEPTS: Deep Explanations

---

## 1. Pino

### WHAT is it?

Pino is a Node.js logging library that prioritizes **speed** above all else. It was created by Matteo Collina (Node.js Technical Steering Committee member) and David Mark Clements.

### WHY do we use it?

Because logging is on the hot path of every request. A slow logger makes a fast API slow. Pino's benchmark results (see 07-RESEARCH.md) show it is 5–10x faster than Winston in high-throughput scenarios.

### HOW does it work?

Pino's core optimization is simple: **avoid doing work in the main thread.**

```
Traditional logger (Winston style):
  1. Accept log object
  2. Run formatters (colorize, pad, timestamp interpolation)
  3. JSON.stringify()
  4. Write to transport (file, HTTP, console)
  → All in the event loop

Pino:
  1. Accept log object
  2. JSON.stringify() directly (no formatters)
  3. Write to stdout via fast file descriptor
  → Optional: offload to worker thread with pino.destination()
```

Pino uses a technique called **"zero-cost logging"**: if the log level is `info` and you call `logger.debug()`, Pino returns immediately without allocating objects or serializing anything.

```ts
const logger = pino({ level: 'info' });
logger.debug({ hugeObject }, 'expensive message'); // Does NOTHING. Zero cost.
```

### WRONG way vs RIGHT way

```ts
// WRONG: Interpolating strings manually
logger.info(`User ${user.name} logged in from ${user.ip}`);
// Pino must parse this string. Downstream systems can't query "ip" field.

// RIGHT: Pass structured data
logger.info({ userName: user.name, ip: user.ip }, 'user logged in');
// Every field is queryable. No parsing needed.
```

### Related concepts

- **Redaction:** Pino can automatically strip sensitive fields (`password`, `token`) from logs before serialization.
- **Child loggers:** `logger.child({ requestId })` creates a new logger that always includes `requestId`. Cheap because it reuses the parent's stream.

---

## 2. Structured Logging

### WHAT is it?

Logging where every log entry is a key-value object (typically JSON) instead of a human-readable string.

### WHY do we use it?

Plain text:
```
2024-01-15T10:23:01Z GET /users 200 45ms
```

To find all requests slower than 100ms, you need regex: `grep -E '([0-9]+)ms' | awk ...`

Structured JSON:
```json
{"time":1705315381000,"level":30,"method":"GET","path":"/users","statusCode":200,"durationMs":45}
```

Query: `durationMs > 100`. No regex. No parsing. Instant.

### HOW does it work?

Log aggregation systems (Elasticsearch, Loki, CloudWatch Logs Insights) index JSON fields individually. When you search `statusCode:500`, the database looks up the inverted index for that field. With plain text, it must scan every log line.

### WRONG way vs RIGHT way

```ts
// WRONG: Unstructured strings
console.log(`Request failed: ${err.message}`);

// WRONG: Mixing formats
console.log(JSON.stringify({ level: 'error', msg: err.message }));
// Inconsistent field names. Some logs have "msg", some have "message".

// RIGHT: Consistent schema, one logger instance
logger.error({ err, requestId }, 'request failed');
// Every error log has "err" object and "requestId" field.
```

### Related concepts

- **Log levels:** `trace(10) < debug(20) < info(30) < warn(40) < error(50) < fatal(60)`. Numeric levels allow filtering by threshold.
- **Correlation IDs:** A UUID attached to every log in a request chain, enabling distributed tracing.

---

## 3. Express Middleware

### WHAT is it?

A function with signature `(req, res, next) => void` that sits between the raw HTTP request and your route handler. It can inspect/modify `req` and `res`, or terminate the chain.

### WHY do we use it?

Cross-cutting concerns (logging, auth, CORS, body parsing) should not be duplicated in every route handler. Middleware lets you write them once and apply them globally.

### HOW does it work?

Express maintains an internal array of middleware functions. For each request, it calls them in order.

```
Request arrives
  │
  ▼
middleware[0] ──next()──> middleware[1] ──next()──> middleware[2]
                                                         │
                                                         ▼
                                                    route handler
                                                         │
                                                         ▼
                                                    res.send()
                                                         │
                                                    (no next() — chain ends)
```

**Critical detail:** If a middleware does not call `next()` and does not end the response (`res.send()`, `res.json()`), the request hangs. The client gets a timeout after 30–120 seconds.

### WRONG way vs RIGHT way

```ts
// WRONG: Forgetting next() in non-terminal middleware
app.use((req, res, next) => {
  console.log('I am a logger');
  // Oops, no next(). Request hangs forever.
});

// RIGHT: Always call next() unless you're ending the response
app.use((req, res, next) => {
  console.log('I am a logger');
  next(); // Pass control to the next middleware
});
```

### Related concepts

- **Error-handling middleware:** Has signature `(err, req, res, next) => void`. Must be registered LAST in the app.
- **Router-level middleware:** `express.Router()` creates isolated middleware stacks for sub-routes (`/api/users`, `/api/posts`).

---

## 4. Event Emitters

### WHAT is it?

Node.js's built-in pattern for publish-subscribe communication. Objects that inherit from `EventEmitter` can emit named events and register listeners for those events.

### WHY do we use it?

HTTP in Node.js is built on EventEmitters. The `req` and `res` objects are streams, which are EventEmitters. To hook into lifecycle events (like response completion), we must use `.on('event', callback)`.

### HOW does it work?

```ts
import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();

// Subscribe (listener)
emitter.on('greet', (name) => {
  console.log(`Hello, ${name}`);
});

// Publish (emit)
emitter.emit('greet', 'Alice'); // → "Hello, Alice"
```

The response object emits `'finish'` when the response is fully transmitted. It also emits `'close'` if the underlying connection is terminated early.

### WRONG way vs RIGHT way

```ts
// WRONG: Listening to 'end' instead of 'finish'
res.on('end', () => { ... });
// 'end' is for readable streams. ServerResponse does not emit 'end'.

// WRONG: Forgetting that listeners accumulate
for (let i = 0; i < 1000; i++) {
  res.on('finish', () => console.log('done'));
}
// 1000 listeners on one response object. Memory leak. EventEmitter warns you.

// RIGHT: Use .once() for one-shot events
res.once('finish', () => {
  console.log('Response finished — logged once');
});
```

### Related concepts

- **Streams:** A specialized EventEmitter for handling continuous data (HTTP bodies, file reads). `req` is a readable stream; `res` is a writable stream.
- **Event loop phases:** Event callbacks execute in the `poll` phase of the event loop. This means `'finish'` listeners run after all synchronous code in the current tick completes.

---

## 5. Response Timing

### WHAT is it?

Measuring how long a server takes to process an HTTP request, from arrival to the last byte being sent.

### WHY do we measure it?

Duration is the most important metric for API health. Users care about latency. SLOs (Service Level Objectives) are defined in milliseconds. Alerting fires when `p99 duration > 500ms`.

### HOW does it work?

We capture `Date.now()` at request arrival and subtract it from `Date.now()` at response completion.

```ts
const startTime = Date.now(); // milliseconds since Unix epoch

res.on('finish', () => {
  const durationMs = Date.now() - startTime;
});
```

`Date.now()` uses the system clock. For higher precision, you can use `process.hrtime.bigint()` (nanoseconds), but milliseconds are sufficient for HTTP APIs.

### WRONG way vs RIGHT way

```ts
// WRONG: Measuring only handler time, not full response time
app.get('/', (req, res) => {
  const start = Date.now();
  const data = fetchData(); // 5ms
  res.json(data);
  const duration = Date.now() - start; // 5ms
  // But JSON.stringify(data) and socket write took another 15ms. Total 20ms.
});

// WRONG: Using Date.now() in the outer scope (THE BUG)
export function requestLogger(logger: Logger) {
  const startTime = Date.now(); // Captured ONCE at middleware creation
  return (req, res, next) => {
    res.on('finish', () => {
      const duration = Date.now() - startTime; // Time since SERVER BOOT, not request
    });
  };
}

// RIGHT: Per-request start time + finish event
export function requestLogger(logger: Logger) {
  return (req, res, next) => {
    const startTime = Date.now(); // Captured PER REQUEST
    res.on('finish', () => {
      const duration = Date.now() - startTime; // Actual request duration
      logger.info({ durationMs: duration, ... });
    });
    next();
  };
}
```

### Related concepts

- **Performance APIs:** `performance.now()` (browser) vs `process.hrtime()` (Node). `hrtime` is monotonic (not affected by system clock changes).
- **OpenTelemetry / tracing:** Modern systems don't just log duration; they create "spans" that form a tree of operations (HTTP → DB query → cache lookup). Duration becomes a nested metric.

---

## Bonus: `.d.ts` Files

### WHAT is it?

A `.d.ts` file is a **TypeScript declaration file**. It contains type definitions without implementation code.

### WHY does it exist?

JavaScript libraries (like Express, Pino) are written in JavaScript, not TypeScript. TypeScript doesn't know what `express()` returns or what `req.params` is. `.d.ts` files teach the TypeScript compiler about JavaScript APIs.

### HOW does it work?

When you `npm install @types/express`, you're downloading `node_modules/@types/express/index.d.ts`. It looks like this:

```ts
// Simplified excerpt
import * as core from 'express-serve-static-core';

declare function express(): core.Express;

declare namespace express {
  interface Request extends core.Request {}
  interface Response extends core.Response {}
}

export = express;
```

TypeScript reads this during compilation. Now when you write:

```ts
import express from 'express';
const app = express();
```

TypeScript knows `app` is an `Express` instance and can autocomplete `app.get()`, `app.use()`, etc.

### WRONG way vs RIGHT way

```ts
// WRONG: Writing @ts-ignore because types are missing
// @ts-ignore
app.unknownMethod(); // Compiles, crashes at runtime

// RIGHT: Install the correct @types package
npm install -D @types/express

// WRONG: Writing your own .d.ts when one already exists
// (duplicate type definitions cause conflicts)

// RIGHT: Generate .d.ts for your own library
// tsconfig.json: "declaration": true
// TypeScript emits .d.ts alongside .js so consumers get types
```

### Related concepts

- **`skipLibCheck: true`:** In `tsconfig.json`, this skips type checking of all `.d.ts` files. It speeds up compilation but may hide type errors in dependencies.
- **Triple-slash directives:** `/// <reference types="node" />` tells TypeScript to include Node.js type definitions.
