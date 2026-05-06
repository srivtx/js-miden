# HOW: Retry Logic

## Implementation Steps

### Step 1: Define Retry Options

```typescript
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}
```

### Step 2: Check Retryable Errors

```typescript
private isRetryable(error: any): boolean {
  // Timeout
  if (error.name === 'AbortError') return true;

  // 5xx errors
  if (error.message?.includes('HTTP 5')) return true;

  // Network errors
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ETIMEDOUT') return true;

  // Do NOT retry 4xx
  if (error.message?.includes('HTTP 4')) return false;

  return false;
}
```

### Step 3: Calculate Backoff with Jitter

```typescript
private calculateDelay(attempt: number): number {
  const exponential = Math.min(
    this.baseDelayMs * Math.pow(2, attempt),
    this.maxDelayMs
  );

  // Full jitter: random value between 0 and exponential
  const jitter = Math.random() * exponential;

  return jitter;
}
```

### Step 4: Execute with Retry

```typescript
async fetch(url: string): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        if (!this.isRetryable(error)) {
          throw error; // Don't retry 4xx
        }
        throw error; // Will retry 5xx
      }

      return response;
    } catch (error: any) {
      lastError = error;

      if (!this.isRetryable(error)) {
        throw error;
      }

      if (attempt < this.maxRetries) {
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
  }

  throw lastError;
}
```

### Step 5: Timeout Each Attempt

```typescript
private async fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    this.timeoutMs
  );

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
```

## Backoff Strategies Comparison

| Strategy | Delay Pattern | Use Case |
|----------|--------------|----------|
| Fixed | 1s, 1s, 1s | Predictable load |
| Linear | 1s, 2s, 3s | Moderate backoff |
| Exponential | 1s, 2s, 4s | Aggressive backoff |
| Equal Jitter | 0.5s-1s, 1s-2s, 2s-4s | Prevent thundering herd |

## Best Practices

- Only retry idempotent operations
- Always add jitter
- Never retry 4xx errors
- Set per-attempt timeouts
- Log all retry attempts
- Limit total retry duration
- Respect Retry-After headers
