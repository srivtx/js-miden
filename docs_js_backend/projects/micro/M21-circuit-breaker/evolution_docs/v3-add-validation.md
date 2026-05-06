# M21 Circuit Breaker — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Your TypeScript circuit breaker accepts any configuration:

```ts
const breaker = new CircuitBreaker({
  failureThreshold: -5,        // Negative? Nonsense.
  failureWindowMs: 0,          // Zero? Every failure is "in the window".
  halfOpenTimeoutMs: -1000,    // Negative? Time travel?
  timeoutMs: 0,                // Zero? Every call times out instantly.
});
```

Without validation:
- **Negative thresholds:** Circuit opens after `-5` failures (never, or immediately depending on comparison bug)
- **Zero windows:** All failures are in the window, circuit behavior is unpredictable
- **Zero timeout:** Every call fails instantly
- **Missing options:** `undefined` values cause `NaN` in comparisons

## The Fix: Runtime Configuration Validation

```ts
interface CircuitBreakerOptions {
  failureThreshold: number;
  failureWindowMs: number;
  halfOpenTimeoutMs: number;
  timeoutMs: number;
}

function validateOptions(options: Partial<CircuitBreakerOptions>): CircuitBreakerOptions {
  const {
    failureThreshold = 5,
    failureWindowMs = 60000,
    halfOpenTimeoutMs = 30000,
    timeoutMs = 5000,
  } = options;

  if (failureThreshold <= 0) {
    throw new Error('failureThreshold must be positive');
  }
  if (failureWindowMs <= 0) {
    throw new Error('failureWindowMs must be positive');
  }
  if (halfOpenTimeoutMs <= 0) {
    throw new Error('halfOpenTimeoutMs must be positive');
  }
  if (timeoutMs <= 0) {
    throw new Error('timeoutMs must be positive');
  }

  return { failureThreshold, failureWindowMs, halfOpenTimeoutMs, timeoutMs };
}

export class CircuitBreaker {
  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = validateOptions(options);
  }
}
```

**What validation prevents:**
- **Nonsensical config:** Negative values rejected at construction time
- **Instant failure mode:** `timeoutMs: 0` is caught before deployment
- **Silent defaults:** Explicit defaults with validation, not `undefined` math

## The Pain That Remains

You deploy. The external API starts failing. Your circuit should open after 5 failures. It doesn't. You check your logs... you have none. You can't see the state transitions, failure counts, or why the circuit stays closed.

## What v4 Fixes

Logging. Observe circuit behavior in production.
