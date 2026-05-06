# Bugs: Circuit Breaker

## Bug 1: No Failure Threshold

### Location
`src/circuit-breaker.ts` - `onFailure()` method

### The Bug

```typescript
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();
  // Missing threshold check!
}
```

### Expected Behavior
After 5 failures in 60 seconds, the circuit should open.

### Actual Behavior
The circuit stays closed forever, sending every request to the failing service.

### Impact
- Resources wasted on doomed requests
- No fail-fast protection
- Cascading failure risk
- Downstream service never gets recovery time

### Failing Test
```typescript
it('should open circuit after 5 failures in 60s', async () => {
  for (let i = 0; i < 5; i++) {
    await request(app).get('/api/external');
  }
  const res = await request(app).get('/api/external');
  expect(res.status).toBe(503); // FAILS - gets 500 instead
});
```

### The Fix

```typescript
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();

  if (this.failures.length >= this.options.failureThreshold) {
    this.state = 'open';
    this.lastOpenTime = Date.now();
  }
}
```

---

## Bug 2: No Request Timeout

### Location
`src/circuit-breaker.ts` - `executeWithTimeout()` method

### The Bug
The timeout parameter exists but is set to a very high value or not enforced properly, causing requests to hang on slow APIs.

### Expected Behavior
Requests should timeout after 5 seconds.

### Actual Behavior
Requests can hang indefinitely.

### Impact
- Thread/memory exhaustion
- Slow response to users
- Resource leaks

### Failing Test
```typescript
it('should timeout slow requests', async () => {
  const start = Date.now();
  try {
    await breaker.execute(() => new Promise(() => {}));
  } catch (e: any) {
    expect(e.message).toBe('Request timeout');
    expect(Date.now() - start).toBeLessThan(6000);
  }
});
```

### The Fix
Ensure `timeoutMs` is passed correctly and enforced:

```typescript
private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, this.options.timeoutMs);

    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}
```
