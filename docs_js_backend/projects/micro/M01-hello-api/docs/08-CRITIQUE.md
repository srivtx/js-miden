# 08 — CRITIQUE: What a Senior Engineer Would Say

This section is a fictional but realistic code review from a staff engineer who has maintained Node.js services at scale for a decade.

---

## 1. "Where's the Error Handling Middleware?"

**Current state:** If a route handler throws, Express catches synchronous errors and returns a 500. But there's no custom error handler, so the client gets Express's default HTML error page. There's also no logging of the stack trace.

**The criticism:** In production, you NEED an error-handling middleware at the bottom of the stack:

```ts
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, requestId: (req as any).id }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});
```

**Why it matters:** Without this, you don't know WHAT failed or WHICH request caused it. The `requestId` in the error log lets you correlate the failure with the request log.

**Educational gap:** This project intentionally omits error handling to keep scope tight. In a real service, error handling is 20% of the codebase.

---

## 2. "No Log Sampling or Rate Limiting"

**Current state:** Every request is logged. At 10,000 req/s, that's 10,000 log lines per second.

**The criticism:** In high-traffic services, you cannot afford to log everything. You need:

- **Sampling:** Log 1% of 200s, log 100% of 500s.
- **Rate limiting:** If the same error floods, throttle it.

Pino supports sampling via child loggers or external configuration, but our app doesn't implement it.

**Real-world impact:** A logging backend (Datadog, Splunk) charges per gigabyte ingested. Unsampled logs at high scale can cost thousands of dollars per month.

---

## 3. "No Request Body Logging, But Also No Body Parser"

**Current state:** The app has no `express.json()` middleware, so POST bodies are ignored. This is correct for a GET-only API, but inconsistent if we later add POST routes.

**The criticism:** When you DO add body parsing, you must be extremely careful about what you log. Logging `req.body` containing passwords, credit cards, or PII is a compliance violation (GDPR, SOC2, HIPAA).

**The fix:** If you log bodies, use Pino's built-in redaction:

```ts
const logger = pino({
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', 'req.body.ssn'],
    remove: true,
  },
});
```

**Educational gap:** This project doesn't cover security logging. It should.

---

## 4. `"Date.now()` is Not Monotonic"

**Current state:** We use `Date.now()` for timing.

**The criticism:** `Date.now()` reads the system clock. If an NTP sync adjusts the clock backward during a request, `durationMs` becomes negative.

**The fix:** Use `process.hrtime.bigint()` for nanosecond-precision monotonic timing:

```ts
const start = process.hrtime.bigint();
// ... request handling ...
const durationNs = process.hrtime.bigint() - start;
const durationMs = Number(durationNs) / 1_000_000;
```

`hrtime` is not subject to clock adjustments. It is the correct tool for benchmarking.

**Why we didn't do it:** `Date.now()` is simpler and sufficient for HTTP APIs where millisecond precision is enough. But a senior engineer would flag it in a code review.

---

## 5. "The Health Check is Too Naive"

**Current state:** `GET /health` always returns `{"status": "ok"}`.

**The criticism:** A real health check should verify dependencies:

```ts
app.get('/health', async (_req, res) => {
  const dbHealthy = await db.ping();
  const cacheHealthy = await cache.ping();
  if (dbHealthy && cacheHealthy) {
    res.json({ status: 'ok', checks: { db: true, cache: true } });
  } else {
    res.status(503).json({ status: 'degraded', checks: { db: dbHealthy, cache: cacheHealthy } });
  }
});
```

**Why it matters:** Kubernetes uses health checks to decide if a pod is ready to receive traffic. If the app returns 200 but the database is down, Kubernetes sends traffic to a broken pod.

**Educational gap:** This project has no dependencies, so a deep health check is impossible. But the student should know what a real one looks like.

---

## 6. "No Correlation with Incoming Request ID"

**Current state:** We generate a new `requestId` for every request.

**The criticism:** In a microservices architecture, the API gateway or load balancer usually generates a `x-request-id` header. We should read it:

```ts
const requestId = req.headers['x-request-id'] || randomUUID();
```

**Why it matters:** Without this, you cannot trace a single user action across services. The gateway logs `requestId: abc-123`, our service logs `requestId: def-456`, and there's no way to connect them.

**Security concern:** You must validate the incoming header. A malicious client could send a 1MB string as `x-request-id`, causing log bloat or denial of service.

---

## 7. "No Metrics Beyond Duration"

**Current state:** We log `durationMs` and `statusCode`.

**The criticism:** Logs are for debugging. Metrics are for monitoring. A production service should emit:

- Request rate (req/s)
- Error rate (% of 5xx)
- Latency percentiles (p50, p95, p99)

These belong in a metrics system (Prometheus, StatsD), not in logs. Parsing logs to generate metrics is expensive and lossy.

**The modern approach:** Use OpenTelemetry to emit traces (spans) that contain both timing and context. Export traces to Jaeger, Zipkin, or Datadog APM.

---

## 8. "No Graceful Shutdown of the Logger"

**Current state:** We close the HTTP server on SIGTERM but don't flush the logger.

**The criticism:** If Pino is configured with an asynchronous destination (e.g., `pino.destination()`), log lines in the buffer may be lost during shutdown.

**The fix:**

```ts
process.on('SIGTERM', () => {
  server.close(() => {
    logger.flush(); // Ensure all logs are written
    process.exit(0);
  });
});
```

---

## Summary: Educational Gaps

This micro-project teaches the fundamentals well but intentionally omits:

1. **Error handling middleware** — add in the next iteration.
2. **Log sampling** — essential for high-traffic services.
3. **Log redaction** — critical for security compliance.
4. **Monotonic timers** — correct for benchmarking.
5. **Dependency health checks** — required for container orchestration.
6. **Distributed tracing headers** — required for microservices.
7. **Metrics / OpenTelemetry** — the future of observability.
8. **Logger flush on shutdown** — prevents log loss.

A senior engineer would approve of this as a **learning foundation** but would not approve it merging to production without addressing at least #1, #3, and #5.
