# WRONG vs RIGHT: Retry Logic

## Jitter

### WRONG: No Jitter

```typescript
const delay = Math.min(
  baseDelay * Math.pow(2, attempt),
  maxDelay
);
await sleep(delay); // Exact intervals
```

**Why it's wrong**: All clients retry at exactly 1s, 2s, 4s. When a service recovers, it receives a thundering herd of simultaneous retries and fails again.

### RIGHT: Add Jitter

```typescript
const delay = Math.min(
  baseDelay * Math.pow(2, attempt),
  maxDelay
);
const jitter = Math.random() * delay;
await sleep(jitter); // Random intervals
```

**Why it's right**: Retries are spread out. Recovering service handles gradual load increase.

---

## Retryable Errors

### WRONG: Retry Everything

```typescript
catch (error) {
  if (attempt < maxRetries) {
    await sleep(delay);
    continue; // Retries 4xx, 5xx, everything!
  }
}
```

**Why it's wrong**: Retrying 404 wastes resources. The resource is gone. Retrying 400 retries a bad request.

### RIGHT: Smart Retry Logic

```typescript
catch (error) {
  if (!isRetryable(error)) {
    throw error; // Fail fast on 4xx
  }
  if (attempt < maxRetries) {
    await sleep(delay);
    continue;
  }
}
```

**Why it's right**: Only retries transient failures.

---

## Timeout Per Attempt

### WRONG: One Timeout for All Attempts

```typescript
const start = Date.now();
for (let i = 0; i <= maxRetries; i++) {
  if (Date.now() - start > totalTimeout) break;
  await fetch(url); // No per-attempt timeout!
}
```

**Why it's wrong**: A single hanging request consumes the total timeout budget.

### RIGHT: Timeout Each Attempt

```typescript
for (let i = 0; i <= maxRetries; i++) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
```

**Why it's right**: Each attempt gets its own timeout. Fast failure on hung connections.

---

## Backoff Strategy

### WRONG: Fixed Delay

```typescript
await sleep(1000); // Same delay every time
```

**Why it's wrong**: Doesn't give recovering service enough time between early retries.

### RIGHT: Exponential Backoff

```typescript
const delay = Math.min(
  baseDelay * Math.pow(2, attempt),
  maxDelay
);
```

**Why it's right**: Early retries are quick. Later retries wait longer, giving the service more recovery time.
