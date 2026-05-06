# Bugs: Retry Logic

## Bug 1: No Jitter

### Location
`src/retry-logic.ts` - retry loop

### The Bug

```typescript
if (attempt < this.options.maxRetries) {
  const delay = Math.min(
    this.options.baseDelayMs * Math.pow(2, attempt),
    this.options.maxDelayMs
  );
  // BUG: No jitter - exact intervals
  await this.sleep(delay);
}
```

### Expected Behavior
Retry delays should have random jitter to prevent thundering herd.

### Actual Behavior
All retries happen at exactly 1s, 2s, 4s intervals.

### Impact
- Thundering herd when service recovers
- Service overwhelmed by simultaneous retries
- Recovery followed by immediate failure
- Cascade of retries across all clients

### Failing Test
```typescript
it('should have jitter in retry delays', async () => {
  failWithStatus = 503;
  const durations: number[] = [];

  for (let i = 0; i < 5; i++) {
    requestCount = 0;
    const start = Date.now();
    await request(app).get('/fetch?url=http://localhost:9999/');
    durations.push(Date.now() - start);
  }

  const variance = Math.max(...durations) - Math.min(...durations);
  expect(variance).toBeGreaterThan(100); // FAILS - variance is near 0
});
```

### The Fix

```typescript
private calculateDelay(attempt: number): number {
  const exponential = Math.min(
    this.options.baseDelayMs * Math.pow(2, attempt),
    this.options.maxDelayMs
  );

  // Full jitter
  const jitter = Math.random() * exponential;
  return jitter;
}
```

---

## Bug 2: Retries on 4xx Errors

### Location
`src/retry-logic.ts` - error handling

### The Bug

```typescript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${data}`);
}
```

All non-ok responses are thrown and retried, including 4xx errors.

### Expected Behavior
Only retry 5xx errors and timeouts. Fail immediately on 4xx.

### Actual Behavior
Retries 400, 404, 403, etc., wasting resources.

### Impact
- Wasted resources on doomed requests
- Slower response to users
- Increased load on services
- Higher latency for errors

### Failing Test
```typescript
it('should NOT retry on 4xx errors', async () => {
  failWithStatus = 404;
  const res = await request(app).get('/fetch?url=http://localhost:9999/');

  // Should only be 1 request (no retries)
  expect(requestCount).toBe(1); // FAILS - gets 4
  expect(res.status).toBe(502);
});
```

### The Fix

```typescript
async fetch(url: string): Promise<{ status: number; data: string }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
    try {
      const response = await this.fetchWithTimeout(url);
      const data = await response.text();

      if (!response.ok) {
        // Only retry 5xx and network errors
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`HTTP ${response.status}: ${data}`);
        }
        // 4xx errors fail immediately
        return { status: response.status, data };
      }

      return { status: response.status, data };
    } catch (error: any) {
      lastError = error;

      const isTimeout = error.name === 'AbortError';
      const is5xx = error.message?.includes('HTTP 5');

      if (!isTimeout && !is5xx) {
        throw error; // Don't retry non-retryable errors
      }

      if (attempt < this.options.maxRetries) {
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
```
