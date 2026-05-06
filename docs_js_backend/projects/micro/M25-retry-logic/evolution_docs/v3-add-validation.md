# v3: Add Validation — Retry Logic

## The Pain

You instantiate the retry client:

```typescript
const client = new RetryClient({
  maxRetries: -1,
  baseDelayMs: 0,
  maxDelayMs: -1000,
  timeoutMs: 0,
});
```

It compiles. TypeScript is happy because all fields are `number`. But `maxRetries: -1` means the loop condition `attempt <= -1` is immediately false — no retries ever happen. `baseDelayMs: 0` with `Math.pow(2, attempt)` still works, but `timeoutMs: 0` means `AbortController` fires immediately. Every request times out on the first millisecond.

The code is valid TypeScript. It is invalid logic.

## The Solution

Add runtime validation for retry options.

## Before (No Validation)

```typescript
// src/retry-logic.ts
export class RetryClient {
  constructor(private options: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 10000,
  }) {}
}
```

## After (With Validation)

```typescript
// src/validation.ts
import { RetryOptions } from './retry-logic.js';

export function validateRetryOptions(options: RetryOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Number.isInteger(options.maxRetries) || options.maxRetries < 0) {
    errors.push('maxRetries must be a non-negative integer');
  }

  if (options.baseDelayMs <= 0) {
    errors.push('baseDelayMs must be positive');
  }

  if (options.maxDelayMs < options.baseDelayMs) {
    errors.push('maxDelayMs must be >= baseDelayMs');
  }

  if (options.timeoutMs <= 0) {
    errors.push('timeoutMs must be positive');
  }

  return { valid: errors.length === 0, errors };
}
```

```typescript
// src/retry-logic.ts
import { validateRetryOptions } from './validation.js';

export class RetryClient {
  constructor(private options: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 10000,
  }) {
    const validation = validateRetryOptions(this.options);
    if (!validation.valid) {
      throw new Error(`Invalid retry options: ${validation.errors.join(', ')}`);
    }
  }
}
```

## The Bug It Catches

- `maxRetries: -1` → `Error: maxRetries must be a non-negative integer`
- `baseDelayMs: 0` → `Error: baseDelayMs must be positive`
- `maxDelayMs: 500` with `baseDelayMs: 1000` → `Error: maxDelayMs must be >= baseDelayMs`
- `timeoutMs: 0` → `Error: timeoutMs must be positive`

## Why Validation Matters

- **Logic safety**: TypeScript checks types, not semantics. Validation checks semantics.
- **Fail fast**: Invalid options throw at construction, not at first request
- **Configuration guard**: An env var typo `TIMEOUT_MS=0` is caught immediately
- **Math correctness**: `maxDelayMs >= baseDelayMs` prevents negative jitter

Without validation, TypeScript's `number` type is a lie. With validation, the contract is enforced at runtime.
