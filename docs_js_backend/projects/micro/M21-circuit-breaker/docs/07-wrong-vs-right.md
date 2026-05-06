# WRONG vs RIGHT: Circuit Breaker

## Failure Threshold

### WRONG: Never Open the Circuit

```typescript
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();
  // Missing: check if threshold exceeded
}
```

**Why it's wrong**: The circuit never opens, so every request still goes to the failing service. Resources are wasted, and the system never recovers.

### RIGHT: Open After Threshold

```typescript
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();

  if (this.failures.length >= this.failureThreshold) {
    this.state = 'open';
    this.lastOpenTime = Date.now();
  }
}
```

**Why it's right**: The circuit opens, failing fast and giving the downstream service time to recover.

---

## Request Timeout

### WRONG: No Timeout

```typescript
async execute<T>(fn: () => Promise<T>): Promise<T> {
  return await fn(); // Hangs forever if fn never resolves
}
```

**Why it's wrong**: A slow/frozen downstream service causes requests to hang indefinitely, consuming threads/memory.

### RIGHT: Always Timeout

```typescript
private async executeWithTimeout<T>(
  fn: () => Promise<T>
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 5000)
    ),
  ]);
}
```

**Why it's right**: Fails fast when downstream is unresponsive.

---

## State Reset

### WRONG: Clear All Failures on Single Success

```typescript
private onSuccess(): void {
  this.failures = []; // Too aggressive
  this.state = 'closed';
}
```

**Why it's wrong**: A single success in a sea of failures resets the circuit prematurely.

### RIGHT: Gradual Recovery

```typescript
private onSuccess(): void {
  if (this.state === 'half-open') {
    this.state = 'closed';
    this.failures = [];
  }
  // In closed state, keep failures for window calculation
}
```

**Why it's right**: Only clear failures when transitioning from half-open to closed.

---

## Half-Open Limits

### WRONG: Allow Multiple Requests in Half-Open

```typescript
if (this.state === 'half-open') {
  return await fn(); // Any number of requests pass through
}
```

**Why it's wrong**: Multiple requests in half-open can overwhelm a recovering service.

### RIGHT: Limit to One Test Request

```typescript
if (this.state === 'half-open' && this.halfOpenAttempts >= 1) {
  throw new Error('Circuit breaker is OPEN');
}
this.halfOpenAttempts++;
```

**Why it's right**: Only one test request probes recovery at a time.
