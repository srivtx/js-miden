# M21 Circuit Breaker — v4 Add Logging

## The Bug: Production Visibility Crisis

Your circuit breaker is supposed to protect your system. But in production:
- You don't know if the circuit is open, closed, or half-open
- You don't know how many failures have occurred in the current window
- You don't know if timeout errors are firing
- You can't tell if the circuit is actually protecting anything

```ts
// Without logging — silent state machine
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();
  // BUG: Missing threshold check! But you'd never know.
}
```

The circuit never opens. Every request continues to hit the failing external API. You have no logs showing the failure count or state.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export class CircuitBreaker {
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkTransition();

    if (this.state === 'open') {
      logger.warn({ state: this.state }, 'Circuit breaker is OPEN, rejecting request');
      const error = new Error('Circuit breaker is OPEN');
      (error as any).statusCode = 503;
      throw error;
    }

    if (this.state === 'half-open' && this.halfOpenAttempts >= 1) {
      logger.warn({ state: this.state, halfOpenAttempts: this.halfOpenAttempts },
        'Circuit breaker half-open limit reached');
      const error = new Error('Circuit breaker is OPEN');
      (error as any).statusCode = 503;
      throw error;
    }

    // ...
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      logger.info({ previousState: this.state }, 'Circuit breaker closing after successful half-open request');
      this.state = 'closed';
      this.failures = [];
      this.halfOpenAttempts = 0;
    }
  }

  private onFailure(): void {
    this.failures.push({ timestamp: Date.now() });
    this.cleanupOldFailures();
    logger.warn({
      failureCount: this.failures.length,
      threshold: this.options.failureThreshold,
    }, 'Failure recorded');

    if (this.failures.length >= this.options.failureThreshold) {
      logger.error({
        failureCount: this.failures.length,
        threshold: this.options.failureThreshold,
      }, 'Circuit breaker OPENING due to threshold exceeded');
      this.state = 'open';
      this.lastOpenTime = Date.now();
    }
  }
}
```

Now logs tell the story:
```json
{"level":"warn","failureCount":3,"threshold":5,"msg":"Failure recorded"}
{"level":"warn","failureCount":4,"threshold":5,"msg":"Failure recorded"}
{"level":"error","failureCount":5,"threshold":5,"msg":"Circuit breaker OPENING due to threshold exceeded"}
{"level":"warn","state":"open","msg":"Circuit breaker is OPEN, rejecting request"}
```

**Ah.** The circuit opened at 5 failures as expected. Fast-fail responses are protecting the downstream service.

## The Pain That Remains

You refactor `onFailure` and accidentally delete the threshold check. The circuit never opens. Your logs show failures accumulating, but no open transition. Your tests? None verify that the circuit opens after N failures.

## What v5 Fixes

Testing. The circuit breaker is a state machine. Every transition needs a test.
