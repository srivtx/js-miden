# M21 Circuit Breaker — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add error handling to your external API call:

```js
app.get('/api/external', async (req, res) => {
  try {
    const result = await fetchExternalData();
    res.json(result);
  } catch (error) {
    res.status(error.statusCode).json({ error: error.message });
    // Bug: error might not have statusCode. TypeError: Cannot read property 'statusCode' of undefined
  }
});
```

**The bug:** `fetch()` throws `TypeError: fetch failed`. `TypeError` has no `statusCode`. Your error handler crashes while handling an error.

Another bug:
```js
const breaker = new CircuitBreaker({
  failureThreshold: '5', // Bug: string instead of number
  timeoutMs: 5000,
});
```

Without types, `'5' > 10` is lexicographic string comparison. `'5' > '10'` is `true` in JavaScript. Your circuit breaker logic is broken.

## The Fix: Add TypeScript

```ts
// circuit-breaker.ts
export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold: number;
  failureWindowMs: number;
  halfOpenTimeoutMs: number;
  timeoutMs: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  // ...
}
```

```ts
// index.ts
import express from 'express';
import { CircuitBreaker } from './circuit-breaker.js';

const app = express();

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  failureWindowMs: 60000,
  halfOpenTimeoutMs: 30000,
  timeoutMs: 5000,
});

app.get('/api/external', async (req, res) => {
  try {
    const result = await breaker.execute(async () => {
      // ...
    });
    res.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, circuitState: breaker.getState() });
  }
});
```

**What TS catches:**
- `failureThreshold: '5'` → compile error: `Type 'string' is not assignable to type 'number'`
- `error.statusCode` — `any` is dangerous, but at least the fallback `|| 500` is visible
- `breaker.getState()` returns `CircuitState` — consumers know it's `'closed' | 'open' | 'half-open'`

## The Pain That Remains

TypeScript knows `timeoutMs` is a `number`, but it doesn't enforce that `5000` is reasonable. It doesn't know that `timeoutMs: 0` means instant failure. We need runtime validation of configuration.

## What v3 Fixes

Validation. Ensure configuration is sane before starting the server.
