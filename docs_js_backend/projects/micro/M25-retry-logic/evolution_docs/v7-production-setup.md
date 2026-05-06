# v7: Production Setup — Retry Logic

## The Journey

We started with naive `fetch`, added types, validation, logging, tests, and ESM. Now we have a retry client that won't thundering-herd a recovering service.

## What v7 Adds

- **Idempotency keys**: Safe retries for POST/PUT via `Idempotency-Key` header
- **Exponential backoff with jitter**: `delay = min(base * 2^attempt + jitter, cap)`
- **Retryable error classification**: Only 5xx, timeouts, and network errors
- **AbortController timeouts**: Every attempt capped at N seconds
- **Max retry budget**: Total elapsed time capped, not just attempt count

## The Final Code

```typescript
// src/retry-logic.ts
import { logger } from './logger.js';
import { randomUUID } from 'crypto';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  maxTotalMs: number;
}

export class RetryClient {
  constructor(private options: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 10000,
    maxTotalMs: 60000,
  }) {}

  async fetch(url: string, init?: RequestInit & { idempotencyKey?: string }): Promise<{ status: number; data: string }> {
    const idempotencyKey = init?.idempotencyKey || randomUUID();
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      if (Date.now() - startTime > this.options.maxTotalMs) {
        throw new Error('Max total retry budget exceeded');
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            ...init?.headers,
            'Idempotency-Key': idempotencyKey,
          },
        });
        clearTimeout(timeout);

        const data = await response.text();

        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            logger.warn({ url, status: response.status }, 'Non-retryable 4xx, failing fast');
            throw new Error(`HTTP ${response.status}: ${data}`);
          }
          throw new Error(`HTTP ${response.status}: ${data}`);
        }

        logger.info({ url, attempt }, 'Request succeeded');
        return { status: response.status, data };
      } catch (error: any) {
        lastError = error;
        const isTimeout = error.name === 'AbortError';
        const is5xx = error.message?.includes('HTTP 5');

        if (!isTimeout && !is5xx && !error.message?.includes('fetch failed')) {
          throw error; // Non-retryable
        }

        if (attempt < this.options.maxRetries) {
          const base = this.options.baseDelayMs * Math.pow(2, attempt);
          const jitter = Math.random() * base;
          const delay = Math.min(base + jitter, this.options.maxDelayMs);
          logger.info({ url, attempt, delayMs: Math.round(delay) }, 'Retrying after delay');
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

## Why This Matters in Production

Without jitter, 1,000 clients all retry at exactly 1s, 2s, 4s — hammering the recovering service back to death. Without idempotency keys, retrying a `POST /charge` bills the customer twice. Without `AbortController`, a hung TCP connection lives forever.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Single failure = user error | Add retry loop |
| v2 | Untyped options pass strings | `RetryOptions` interface |
| v3 | Negative maxRetries loops forever | Validate `maxRetries >= 0` |
| v4 | Silent retries hide root cause | Log every attempt + delay |
| v5 | No tests for thundering herd | Jest tests measure jitter variance |
| v6 | CJS dynamic require issues | ESM with static imports |
| v7 | Duplicate charges, thundering herd | Idempotency keys + jitter + budgets |

## Run It

```bash
RETRY_MAX_RETRIES=3 RETRY_BASE_DELAY_MS=1000 node dist/index.js
```
