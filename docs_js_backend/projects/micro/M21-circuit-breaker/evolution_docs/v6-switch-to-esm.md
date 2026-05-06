# M21 Circuit Breaker — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your circuit breaker project uses a mix:

```json
// package.json
"type": "module",
"test": "NODE_OPTIONS='--experimental-vm-modules' jest --testTimeout=10000"
```

**Problems:**
1. Jest with ESM requires `--experimental-vm-modules` — flaky and slow
2. `ts-jest` config is complex for ESM + TypeScript
3. `require()` might still exist in test setup files
4. No top-level await — can't initialize the breaker config from an async source

## The Fix: ESM (Already Partially There)

The project already has `"type": "module"` in `package.json`. The final step is aligning everything:

```json
// package.json
{
  "name": "m21-circuit-breaker",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch",
    "test": "vitest run"  // or jest with ESM, but vitest is simpler
  }
}
```

```ts
// circuit-breaker.ts
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  failureWindowMs: number;
  halfOpenTimeoutMs: number;
  timeoutMs: number;
}

export class CircuitBreaker {
  // ...
}
```

```ts
// index.ts
import express from 'express';
import { CircuitBreaker } from './circuit-breaker.js';

const app = express();
app.use(express.json());

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  failureWindowMs: 60000,
  halfOpenTimeoutMs: 30000,
  timeoutMs: 5000,
});

export { app, breaker };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Circuit breaker service running on port ${PORT}`);
  });
}
```

**What full ESM gives you:**
- No `--experimental-vm-modules` hacks
- `import.meta.url` for self-execution guards
- Named exports are first-class — `export { app, breaker }`
- File extensions are explicit — `./circuit-breaker.js`

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `circuit-breaker.ts` mixes state management, timeout handling, and metrics. `index.ts` mixes simulation endpoints with real API logic. Time to clean up.

## What v7 Fixes

Final production setup. Clean `src/` directory, proper circuit breaker with timeout, half-open state, and metrics.
