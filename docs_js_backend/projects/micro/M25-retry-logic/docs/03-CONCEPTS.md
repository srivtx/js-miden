# CONCEPTS: Retry Logic

## Concept 1: Exponential Backoff

### WHAT

Exponential backoff is a retry strategy where the delay between retries increases exponentially (doubles) with each attempt.

### WHY

When a service fails, it's often due to overload. Immediately retrying adds more load. Waiting longer between attempts gives the service time to recover. The exponential increase balances responsiveness with recovery time.

### HOW

```typescript
function calculateDelay(attempt: number): number {
  const baseDelay = 1000; // 1 second
  const exponential = Math.min(
    baseDelay * Math.pow(2, attempt),
    16000 // Max cap
  );
  return exponential;
}

// Attempt 0 (initial): 0ms delay
// Attempt 1 (1st retry): 1000ms
// Attempt 2 (2nd retry): 2000ms
// Attempt 3 (3rd retry): 4000ms
// Attempt 4: Would be 8000ms, but capped at 16000ms
```

### WRONG vs RIGHT

**WRONG: Fixed delay**
```typescript
await sleep(1000); // Always 1 second
// If 1000 clients fail simultaneously, they all retry at T+1s, T+2s, T+3s
// The service never gets a break
```

**RIGHT: Exponential backoff with cap**
```typescript
const delay = Math.min(1000 * Math.pow(2, attempt), 16000);
// Delays spread out: 1s, 2s, 4s
// Cap prevents unreasonable waits
```

---

## Concept 2: Jitter

### WHAT

Jitter adds randomness to retry delays so that retries from multiple clients don't synchronize.

### WHY

Without jitter, if 1000 clients fail at the same time (e.g., a service restart), they all retry at exactly T+1s, T+2s, T+4s. This synchronized surge can overwhelm the recovering service. Jitter "smears" the retries across time.

### HOW

```typescript
function calculateDelay(attempt: number): number {
  const exponential = Math.min(
    1000 * Math.pow(2, attempt),
    16000
  );
  
  // Full jitter: random value between 0 and exponential
  const jitter = Math.random() * exponential;
  return jitter;
}

// With exponential = 4000ms:
// Client A waits 1200ms
// Client B waits 3800ms
// Client C waits 500ms
// No synchronized surge
```

### WRONG vs RIGHT

**WRONG: No jitter**
```typescript
const delay = Math.min(1000 * Math.pow(2, attempt), 16000);
await sleep(delay);
// All clients retry at the same millisecond
// Thundering herd
```

**RIGHT: Full jitter**
```typescript
const delay = Math.random() * Math.min(1000 * Math.pow(2, attempt), 16000);
await sleep(delay);
// Retries are randomly distributed
// Smooth recovery
```

---

## Concept 3: Idempotency

### WHAT

An operation is idempotent if performing it multiple times has the same effect as performing it once.

### WHY

Retry logic inherently re-executes operations. If the operation is not idempotent, retries can cause side effects (duplicate charges, duplicate records).

### HOW

```typescript
// Idempotent: Safe to retry
GET /users/123      // Reading data
PUT /users/123      // Updating with full object
DELETE /users/123   // Deleting

// Non-idempotent: Dangerous to retry
POST /charges       // Creating a charge
POST /orders        // Creating an order
```

### WRONG vs RIGHT

**WRONG: Retry everything**
```typescript
// Charging a credit card
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await fetch('/charges', { method: 'POST', body: chargeData });
  } catch {
    await sleep(delay);
  }
}
// User gets charged 4 times!
```

**RIGHT: Only retry idempotent operations, or use idempotency keys**
```typescript
// Using idempotency key
const idempotencyKey = crypto.randomUUID();

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await fetch('/charges', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: chargeData,
    });
  } catch (error) {
    if (!isRetryable(error)) throw error;
    await sleep(delay);
  }
}
// Server deduplicates by idempotency key
```

---

## Concept 4: Retryable vs Non-Retryable Errors

### WHAT

Not all errors should trigger retries. Transient errors (network blips, server overload) are retryable. Permanent errors (bad request, authentication failure) should fail immediately.

### WHY

Retrying permanent errors wastes resources and delays the inevitable failure response to the user.

### HOW

```typescript
function isRetryable(error: any, response?: Response): boolean {
  // Timeouts and network errors
  if (error.name === 'AbortError') return true;
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ETIMEDOUT') return true;
  
  // HTTP status codes
  if (response) {
    if (response.status >= 500) return true; // Server errors
    if (response.status === 429) return true; // Rate limited
    if (response.status >= 400) return false; // Client errors (don't retry)
  }
  
  return false;
}
```

### WRONG vs RIGHT

**WRONG: Retry on all errors**
```typescript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}
// 404 gets retried 3 times
// User waits 7 seconds to get a 404
```

**RIGHT: Classify before retrying**
```typescript
if (!response.ok) {
  if (response.status >= 400 && response.status < 500) {
    // Client error - don't retry
    return { status: response.status, data };
  }
  if (response.status >= 500 || response.status === 429) {
    // Server error or rate limit - retry
    throw new Error(`HTTP ${response.status}`);
  }
}
```
