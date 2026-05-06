# v2: Add TypeScript — Retry Logic

## The Pain

You write the retry client in JavaScript:

```javascript
// src/retry-logic.js
class RetryClient {
  constructor(options) {
    this.options = options || {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 16000,
      timeoutMs: 10000,
    };
  }

  async fetch(url) {
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      // BUG: options.timeoutMs is undefined if options is {}
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      // ...
    }
  }
}
```

You instantiate it wrong:

```javascript
const client = new RetryClient({});
```

`this.options.timeoutMs` is `undefined`. `setTimeout(..., undefined)` defaults to 0 in some environments, 4ms in others. The request aborts immediately. You don't know why.

## The Solution

Add TypeScript. Define interfaces with defaults.

## After (With TypeScript)

```typescript
// src/retry-logic.ts
export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

export class RetryClient {
  constructor(private options: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 10000,
  }) {}

  async fetch(url: string): Promise<{ status: number; data: string }> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        const data = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${data}`);
        }
        return { status: response.status, data };
      } catch (error: any) {
        lastError = error;
        if (attempt < this.options.maxRetries) {
          const delay = Math.min(
            this.options.baseDelayMs * Math.pow(2, attempt),
            this.options.maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## The Bug TypeScript Catches

- `new RetryClient({})` → `Property 'maxRetries' is missing in type '{}' but required in type 'RetryOptions'`
- `new RetryClient({ maxRetries: '3' })` → `Type 'string' is not assignable to type 'number'`
- `client.fetch(123)` → `Argument of type 'number' is not assignable to parameter of type 'string'`
- `this.options.timeoutMs` → `OK` (guaranteed to exist via default parameter or required field)

## Why TypeScript Matters

- **Required fields**: `RetryOptions` forces every field to be provided or use defaults
- **Type safety**: `maxRetries: number` prevents string values
- **Return types**: `Promise<{ status: number; data: string }>` documents the contract
- **IDE support**: Autocomplete shows `maxRetries`, `baseDelayMs`, etc.

Without TypeScript, `{}` creates a broken client. With TypeScript, the compiler demands valid options.
