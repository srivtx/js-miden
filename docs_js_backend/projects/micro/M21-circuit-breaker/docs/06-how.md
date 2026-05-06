# HOW: Circuit Breaker

## Implementation Steps

### Step 1: Define the State Machine

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';
```

### Step 2: Track Failures

Store failure timestamps in a rolling window:

```typescript
interface FailureRecord {
  timestamp: number;
}

private failures: FailureRecord[] = [];
```

### Step 3: Implement State Checks

```typescript
private checkTransition(): void {
  if (this.state === 'open') {
    const elapsed = Date.now() - this.lastOpenTime;
    if (elapsed >= this.halfOpenTimeoutMs) {
      this.state = 'half-open';
      this.halfOpenAttempts = 0;
    }
  }
}
```

### Step 4: Execute with Protection

```typescript
async execute<T>(fn: () => Promise<T>): Promise<T> {
  this.checkTransition();

  if (this.state === 'open') {
    throw new Error('Circuit breaker is OPEN');
  }

  if (this.state === 'half-open' && this.halfOpenAttempts >= 1) {
    throw new Error('Circuit breaker is OPEN');
  }

  try {
    const result = await this.executeWithTimeout(fn);
    this.onSuccess();
    return result;
  } catch (error) {
    this.onFailure();
    throw error;
  }
}
```

### Step 5: Handle Success

```typescript
private onSuccess(): void {
  if (this.state === 'half-open') {
    this.state = 'closed';
    this.failures = [];
    this.halfOpenAttempts = 0;
  }
}
```

### Step 6: Handle Failure (CRITICAL)

```typescript
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();

  // THIS IS THE FIX - Check threshold!
  if (this.failures.length >= this.failureThreshold) {
    this.state = 'open';
    this.lastOpenTime = Date.now();
  }
}
```

### Step 7: Clean Up Old Failures

```typescript
private cleanupOldFailures(): void {
  const cutoff = Date.now() - this.failureWindowMs;
  this.failures = this.failures.filter(f => f.timestamp > cutoff);
}
```

### Step 8: Add Request Timeout

```typescript
private async executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}
```

## Configuration Best Practices

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| failureThreshold | 5 | High enough to avoid false positives |
| failureWindowMs | 60000 | 1 minute balances responsiveness and stability |
| halfOpenTimeoutMs | 30000 | Gives downstream time to recover |
| timeoutMs | 5000 | Prevents indefinite hangs |
