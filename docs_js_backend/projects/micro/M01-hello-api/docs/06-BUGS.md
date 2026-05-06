# 06 — BUGS: The Intentional Closure Scope Bug

This project contains exactly one intentional bug. It is subtle, realistic, and teaches a fundamental lesson about JavaScript closures.

---

## The Bug: Wrong Scope for `startTime`

### Location

`src/middleware/logger.ts`, lines 18–22:

```ts
export function requestLogger(logger: Logger) {
  const startTime = Date.now();  // ← BUG

  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    // ...
    res.on('finish', () => {
      const durationMs = Date.now() - startTime; // Uses the outer startTime
      // ...
    });
    next();
  };
}
```

### Why It Exists

This bug is intentionally placed to demonstrate a common mistake in middleware factory functions. The `startTime` variable is declared in the **outer function scope** (the factory), so it is evaluated **once** when `requestLogger(logger)` is called—usually at server startup or test setup. Every subsequent request subtracts that same fixed timestamp, meaning `durationMs` actually measures **how long the server has been running**, not how long the request took.

### The Symptom

Run `npm test`:

```
FAIL  tests/app.test.ts > Hello API > logs response time under 20ms for a fast handler
AssertionError: expected 52 to be less than 20
```

The logged `durationMs` is ~52ms even though the handler itself is instantaneous (it just calls `res.send('ok')`).

### Reproduction

The test that catches it deliberately waits 50ms after creating the app, then makes a request:

```ts
it('logs response time under 20ms for a fast handler', async () => {
  const { logger, logs } = createTestLogger();
  const app = express();
  app.use(requestLogger(logger));   // startTime is captured HERE
  app.get('/fast', (_req, res) => res.send('ok'));

  await new Promise((r) => setTimeout(r, 50));  // 50ms of idle time

  await request(app).get('/fast');  // Handler takes <1ms

  const duration = logs[0].durationMs as number;
  expect(duration).toBeLessThan(20);  // FAILS: 50ms + 1ms = 51ms
});
```

If you run the test immediately after creating the app, the bug is **invisible** because the elapsed time is tiny (<5ms). This is why the test waits: to expose the scoping error.

### Why This Is Dangerous in Production

In production, this bug creates a **latency illusion**:

| Server Uptime | Logged `durationMs` | Actual Handler Time | Drift |
|---------------|---------------------|---------------------|-------|
| 1 minute      | 60,000ms            | 2ms                 | 59,998ms |
| 1 hour        | 3,600,000ms         | 2ms                 | Huge |
| 1 day         | 86,400,000ms        | 2ms                 | Catastrophic |

Your dashboards show requests taking hours. Alerts fire on fake SLO breaches. You waste days debugging network issues that don't exist.

### The Fix

Move `startTime` inside the returned middleware function so it is evaluated **once per request**:

```ts
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();  // ← CORRECT: captured PER REQUEST
    const requestId = randomUUID();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;  // Actual request duration
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

### Why the Fix Works

JavaScript closures capture **variables**, not **values**. When `startTime` is in the outer scope, all 10,000 request closures share the SAME variable binding. When it's in the inner scope, each request gets its OWN variable binding.

```
Outer scope (factory):
  startTime ──shared──> closure #1
              ──shared──> closure #2
              ──shared──> closure #3

Inner scope (per-request):
  closure #1 has startTime_A
  closure #2 has startTime_B
  closure #3 has startTime_C
```

### Real-World Impact

This exact bug class has caused production incidents:

- **AWS Lambda cold starts:** A middleware factory captured a timestamp in the module scope (outside the handler). In Lambda, the module scope persists across invocations. The "duration" grew with each warm invocation.
- **Express rate limiters:** A popular npm package once stored `lastRequestTime` in the factory scope, causing rate limits to apply globally instead of per-IP.
- **WebSocket connection tracking:** A connection counter incremented in the factory scope instead of the connection handler, leaking memory and showing impossible connection counts.

### Prevention

1. **Always ask:** "Should this variable be per-request or per-server?"
2. **Use linters:** ESLint rule `no-loop-func` catches some closure mistakes.
3. **Write time-sensitive tests:** Always include a delay in timing tests to catch scope bugs.
4. **Code review check:** In middleware factories, every variable declared outside the returned function should be justified.
