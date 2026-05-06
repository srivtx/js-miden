# M13: Request Logger

An Express middleware that logs every request with method, path, status, duration, and user-agent.

## Endpoints

- `POST /login` - Authenticate (returns JWT token)
- `GET /health` - Health check

## Quick Start

```bash
npm install
npm run dev      # development server on :3000
npm test         # run tests
```

## Phase 1: Basic Implementation

The logger attaches to the `finish` event of the response so it never blocks the handler from sending data:

```typescript
res.on('finish', () => {
  console.log(JSON.stringify({
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: Date.now() - start,
    userAgent: req.headers['user-agent'],
    body: req.body,
  }));
});
```

By waiting for `finish`, the response is sent before logging begins.

## Phase 2-3: Design Thinking

### 1. Sync vs Async Logging

**Decision needed:** Should logging block the event loop?

- **console.log (current, partially buggy):** Writes to stdout synchronously.
  - Pros: Simple, ordered output.
  - Cons: Under high load, blocking I/O can degrade throughput.
- **Async stream (pino, winston with async transport):** Buffers and flushes asynchronously.
  - Pros: Does not block the event loop.
  - Cons: Slightly more complex, potential for log loss on crash.
- **Offload to worker thread:** Completely decouples logging from the main thread.
  - Pros: Zero main-thread blocking.
  - Cons: Complex, usually overkill for small apps.

**Conclusion:** For production APIs, use a high-performance logger like `pino` with async destination. For learning, `console.log` on `res.finish` is acceptable but not optimal.

### 2. Sensitive Data Redaction

**Decision needed:** Should request bodies be logged?

- **Log everything (current, BUGGY):** Captures the full `req.body`.
  - Cons: **Passwords, tokens, PII leak into logs.** Logs are often less secure than databases and may be shipped to third-party services.
- **Redact sensitive fields:** Maintain a deny-list (`password`, `token`, `creditCard`, `ssn`) and replace values with `[REDACTED]`.
- **Log only safe fields:** Whitelist known-safe fields.

**Conclusion:** Never log raw request bodies without redaction. Implement a deny-list of sensitive keys and recursively scrub them.

### 3. Log Rotation & Retention

**Decision needed:** How do we manage log files?

- **Stdout only:** Let the process manager (systemd, Docker) handle rotation.
- **File with rotation (pino-roll, logrotate):** Automatic daily/hourly rotation.
- **Centralized (Datadog, ELK, CloudWatch):** Ship logs off-host immediately.

**Conclusion:** For microservices, write structured JSON to stdout and let the platform aggregate. For long-running VMs, use file rotation.

### 4. Structured Logging

Plain text logs are hard to query. Structured JSON with consistent fields enables filtering and alerting.

**Conclusion:** Always log in JSON with at least: `timestamp`, `level`, `requestId`, `method`, `path`, `status`, `duration`, `userAgent`.

## Known Bug

The current implementation **leaks sensitive data into logs**:

`req.body` is serialized directly, so a login request containing `{ username: "admin", password: "secret" }` writes the plaintext password into the log output.

### How to fix

```typescript
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))
      ? '[REDACTED]'
      : redact(value);
  }
  return clone;
}

res.on('finish', () => {
  console.log(JSON.stringify({
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: Date.now() - start,
    userAgent: req.headers['user-agent'],
    body: redact(req.body),
  }));
});
```

For production, switch to a structured logger like `pino` with async transports:

```typescript
import pino from 'pino';
const logger = pino({ level: 'info' }, pino.destination({ sync: false }));
```
