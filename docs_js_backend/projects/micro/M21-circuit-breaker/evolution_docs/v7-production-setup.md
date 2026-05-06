# M21 Circuit Breaker — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
M21-circuit-breaker/
├── src/
│   ├── index.ts            # Express routes + simulation endpoints
│   └── circuit-breaker.ts  # Circuit breaker implementation
├── tests/
│   └── circuit-breaker.test.ts  # Jest + supertest
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Three-State Circuit Breaker**

```ts
export type CircuitState = 'closed' | 'open' | 'half-open';
```

- **Closed:** Normal operation. Failures are tracked.
- **Open:** Fast-fail. No calls pass through. Protects the downstream service.
- **Half-open:** After timeout, one probe call is allowed. If it succeeds, close. If it fails, open again.

**2. Time-Bounded Failure Window**

```ts
private cleanupOldFailures(): void {
  const cutoff = Date.now() - this.options.failureWindowMs;
  this.failures = this.failures.filter(f => f.timestamp > cutoff);
}
```

Only failures within the last 60 seconds count toward the threshold. A spike 2 hours ago shouldn't keep the circuit open.

**3. Request Timeout**

```ts
private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, this.options.timeoutMs);

    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}
```

Every wrapped call has a hard timeout. Slow dependencies don't hang your event loop.

**4. Half-Open Probe Limit**

```ts
if (this.state === 'half-open' && this.halfOpenAttempts >= 1) {
  const error = new Error('Circuit breaker is OPEN');
  (error as any).statusCode = 503;
  throw error;
}
```

Only one probe call is allowed in half-open state. Multiple concurrent probes could overwhelm a recovering service.

**5. Self-execution Guard**

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
}
```

Tests import `{ app, breaker }` without starting the server.

**6. Simulation Endpoints for Testing**

```ts
let shouldFail = false;

app.post('/simulate/fail', (req, res) => {
  shouldFail = req.body.fail ?? true;
  res.json({ shouldFail });
});
```

These are test helpers, not production APIs. In a real system, the circuit breaker wraps external HTTP calls, not local flags.

### The Intentional Bug (For Learning)

The source code contains a commented-out threshold check in `onFailure()`:

```ts
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();

  // BUG: No failure threshold check - circuit never opens!
  // if (this.failures.length >= this.options.failureThreshold) {
  //   this.state = 'open';
  //   this.lastOpenTime = Date.now();
  // }
}
```

**Why is this here?** To demonstrate that a circuit breaker without tests is worse than no circuit breaker. The tests in `circuit-breaker.test.ts` verify:
- 5 failures should open the circuit
- The 6th request should return 503
- Metrics should show the correct failure count

If you uncomment the threshold check, all tests pass. If you leave it commented, the "should open circuit" test fails — proving the bug.

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | No timeout, no retry, cascading failures | Wrote naive JS |
| v2 | Type errors in error handling | Added TypeScript |
| v3 | Nonsensical configuration values | Added runtime validation |
| v4 | Silent state transitions | Added structured logging |
| v5 | Circuit never opens (missing threshold) | Added comprehensive state machine tests |
| v6 | Legacy module system + jest hacks | Full ESM alignment |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # tsc --watch
npm run build    # tsc
npm start        # node dist/index.js
npm test         # NODE_OPTIONS='--experimental-vm-modules' jest --testTimeout=10000
```

**Note:** This project uses Jest (not Vitest) because it demonstrates ESM compatibility with the most popular test runner. The `--experimental-vm-modules` flag is required for Jest ESM support in Node.js versions prior to full stabilization.
