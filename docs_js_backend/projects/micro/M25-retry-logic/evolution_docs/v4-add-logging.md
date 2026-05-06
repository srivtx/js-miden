# v4: Add Logging — Retry Logic

## The Pain

A user reports: "My request failed after spinning for 30 seconds." You check the server. No error in the application logs. No request log. The retry logic ran 4 times, but you don't know that. The final error was thrown, but nothing logged it.

You have no idea how many retries happened, what delays were used, or why it failed. You cannot reproduce it because you don't know the URL or the timing.

## The Solution

Add structured logging for every retry attempt, delay, and final failure.

## Before (No Logs)

```typescript
// src/retry-logic.ts
async fetch(url: string): Promise<{ status: number; data: string }> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { status: response.status, data: await response.text() };
    } catch (error: any) {
      lastError = error;
      if (attempt < this.options.maxRetries) {
        const delay = Math.min(this.options.baseDelayMs * Math.pow(2, attempt), this.options.maxDelayMs);
        await this.sleep(delay);
      }
    }
  }
  throw lastError || new Error('Max retries exceeded');
}
```

## After (With Logging)

```typescript
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```typescript
// src/retry-logic.ts
import { logger } from './logger.js';

async fetch(url: string): Promise<{ status: number; data: string }> {
  let lastError: Error | undefined;
  logger.info({ url, maxRetries: this.options.maxRetries }, 'Starting request');

  for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      logger.info({ url, attempt, status: response.status }, 'Request succeeded');
      return { status: response.status, data: await response.text() };
    } catch (error: any) {
      lastError = error;
      logger.warn({ url, attempt, error: error.message }, 'Request failed');

      if (attempt < this.options.maxRetries) {
        const delay = Math.min(this.options.baseDelayMs * Math.pow(2, attempt), this.options.maxDelayMs);
        logger.info({ url, attempt, delayMs: delay }, 'Retrying after delay');
        await this.sleep(delay);
      }
    }
  }

  logger.error({ url, attempts: this.options.maxRetries + 1, error: lastError?.message }, 'All retries exhausted');
  throw lastError || new Error('Max retries exceeded');
}
```

## What the Logs Look Like

```json
{"level":30,"time":1715200000000,"url":"https://api.example.com/users","maxRetries":3,"msg":"Starting request"}
{"level":40,"time":1715200000001,"url":"https://api.example.com/users","attempt":0,"error":"HTTP 503","msg":"Request failed"}
{"level":30,"time":1715200000002,"url":"https://api.example.com/users","attempt":0,"delayMs":1000,"msg":"Retrying after delay"}
{"level":40,"time":1715200001003,"url":"https://api.example.com/users","attempt":1,"error":"HTTP 503","msg":"Request failed"}
{"level":30,"time":1715200001004,"url":"https://api.example.com/users","attempt":1,"delayMs":2000,"msg":"Retrying after delay"}
{"level":40,"time":1715200003005,"url":"https://api.example.com/users","attempt":2,"error":"HTTP 503","msg":"Request failed"}
{"level":30,"time":1715200003006,"url":"https://api.example.com/users","attempt":2,"delayMs":4000,"msg":"Retrying after delay"}
{"level":40,"time":1715200007007,"url":"https://api.example.com/users","attempt":3,"error":"HTTP 503","msg":"Request failed"}
{"level":50,"time":1715200007008,"url":"https://api.example.com/users","attempts":4,"error":"HTTP 503","msg":"All retries exhausted"}
```

## Why Logging Matters

- **Incident response**: You see 4 attempts with 503s — the backend was down
- **Delay verification**: Logs confirm exponential backoff (1s, 2s, 4s)
- **Jitter detection**: With jitter, delayMs varies slightly per attempt
- **User support**: "Your request failed after 4 attempts over 7 seconds" is a real answer

Without logs, retry logic is a black box. With logs, every attempt is traceable.
