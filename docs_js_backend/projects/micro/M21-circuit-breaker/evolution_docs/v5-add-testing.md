# M21 Circuit Breaker — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the circuit breaker to "simplify" failure tracking:

```ts
// BEFORE — correct
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();
  if (this.failures.length >= this.options.failureThreshold) {
    this.state = 'open';
    this.lastOpenTime = Date.now();
  }
}

// AFTER — "cleaner" but BROKEN
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();
  // Oops, removed the threshold check during refactor
}
```

**This exact bug exists in the source code intentionally as a teaching example.** The `onFailure` method in `circuit-breaker.ts` has a comment:
```ts
// BUG: No failure threshold check - circuit never opens!
// The line below is intentionally missing:
// if (this.failures.length >= this.options.failureThreshold) {
//   this.state = 'open';
//   this.lastOpenTime = Date.now();
// }
```

Without tests, this ships. The circuit breaker **never opens**. It accumulates failures forever but never protects the system. It's worse than no circuit breaker — it gives you false confidence.

## The Fix: Comprehensive State Machine Tests

```ts
// tests/circuit-breaker.test.ts
import request from 'supertest';
import { app, breaker } from '../src/index.js';

describe('Circuit Breaker', () => {
  beforeEach(async () => {
    await request(app).post('/simulate/fail').send({ fail: true });
    (breaker as any).state = 'closed';
    (breaker as any).failures = [];
    (breaker as any).lastOpenTime = 0;
    (breaker as any).halfOpenAttempts = 0;
  });

  afterEach(async () => {
    await request(app).post('/simulate/fail').send({ fail: false });
  });

  it('should return success when external API works', async () => {
    await request(app).post('/simulate/fail').send({ fail: false });
    const res = await request(app).get('/api/external');
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('success');
  });

  it('should open circuit after 5 failures in 60s', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }
    const res = await request(app).get('/api/external');
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('OPEN');
  });

  it('should track failure count in metrics', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/external');
    }
    const health = await request(app).get('/health');
    expect(health.body.metrics.failuresInWindow).toBe(3);
  });

  it('should transition to half-open after timeout', async () => {
    const originalTimeout = (breaker as any).options.halfOpenTimeoutMs;
    (breaker as any).options.halfOpenTimeoutMs = 100;

    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }

    await new Promise(r => setTimeout(r, 150));
    const health = await request(app).get('/health');
    expect(health.body.state).toBe('half-open');

    (breaker as any).options.halfOpenTimeoutMs = originalTimeout;
  });

  it('should close circuit after successful half-open request', async () => {
    const originalTimeout = (breaker as any).options.halfOpenTimeoutMs;
    (breaker as any).options.halfOpenTimeoutMs = 100;

    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }

    await new Promise(r => setTimeout(r, 150));
    await request(app).post('/simulate/fail').send({ fail: false });

    const res = await request(app).get('/api/external');
    expect(res.status).toBe(200);

    const health = await request(app).get('/health');
    expect(health.body.state).toBe('closed');

    (breaker as any).options.halfOpenTimeoutMs = originalTimeout;
  });
});
```

**What tests prevent:**
- Missing threshold check? **Caught** — 6th request must return 503.
- Broken state transition? **Caught** — `half-open` must appear after timeout.
- Failure count drift? **Caught** — metrics must track exactly 3 failures.
- Half-open success not closing? **Caught** — state must return to `closed`.

## The Pain That Remains

Your tests import `{ app, breaker }` from ESM files, but the project still has CJS vestiges. Modern Node.js is ESM-first. The `jest` config in `package.json` requires `--experimental-vm-modules` because it's straddling both worlds.

## What v6 Fixes

Switch to ESM fully. CommonJS is legacy.
