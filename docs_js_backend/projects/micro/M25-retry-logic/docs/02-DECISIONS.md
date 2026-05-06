# DECISIONS: Retry Logic

## Decision 1: Exponential Backoff vs Fixed Delay

### Option A: Exponential Backoff (What We Chose)

```typescript
const delay = Math.min(
  baseDelayMs * Math.pow(2, attempt),
  maxDelayMs
);
// Attempt 0: 1s
// Attempt 1: 2s
// Attempt 2: 4s
```

**Pros:**
- Gives recovering service more time between attempts
- Reduces load on failing service
- Industry standard (AWS, Google)

**Cons:**
- Long total wait time
- Users may see timeouts before retries complete

### Option B: Fixed Delay

```typescript
const delay = baseDelayMs; // Always 1s
```

**Pros:**
- Predictable total time
- Simpler to reason about

**Cons:**
- Doesn't give service recovery time
- Can overwhelm service with regular intervals
- Not recommended by any major cloud provider

### Option C: Linear Backoff

```typescript
const delay = baseDelayMs * attempt; // 1s, 2s, 3s
```

**Pros:**
- Faster than exponential
- More recovery time than fixed

**Cons:**
- Less recovery time than exponential
- Rarely used in practice

**Why we chose A:** AWS, Google, and Microsoft all recommend exponential backoff. It's the proven standard.

---

## Decision 2: Full Jitter vs Equal Jitter vs Decorrelated Jitter

### Option A: Full Jitter (What We Chose as Correct)

```typescript
const jitter = Math.random() * delay;
return jitter;
// Delay 4s -> actual wait: 0s to 4s
```

**Pros:**
- Maximally spreads out retries
- Lowest collision probability
- AWS recommendation

**Cons:**
- Can be much shorter than base delay
- Less predictable

### Option B: Equal Jitter

```typescript
const jitter = delay / 2 + Math.random() * (delay / 2);
// Delay 4s -> actual wait: 2s to 4s
```

**Pros:**
- Never less than half the calculated delay
- More predictable than full jitter

**Cons:**
- Less spread than full jitter
- Higher collision probability

### Option C: Decorrelated Jitter

```typescript
const delay = Math.min(maxDelayMs, baseDelayMs * 3 * Math.random());
// Each retry is independent of previous
```

**Pros:**
- Best theoretical performance (lowest collision rate)
- Simple stateless calculation

**Cons:**
- Can jump from 1s to 16s randomly
- Less intuitive

**Why we chose A (full jitter):** It's the AWS-recommended approach and provides the best protection against thundering herd. The `cockatiel` and `opossum` libraries use full jitter by default.

---

## Decision 3: Retry on All Errors vs Selective Retry

### Option A: Retry on 5xx and Timeouts Only (What We Chose as Correct)

```typescript
const isRetryable = error.name === 'AbortError' || // Timeout
                   response.status >= 500 ||       // Server error
                   response.status === 429;        // Rate limited
```

**Pros:**
- Doesn't waste effort on permanent failures
- Respects server's 4xx response
- Faster failure for bad requests

**Cons:**
- Need to classify every status code
- Some 4xx might be transient (rare)

### Option B: Retry on All Errors (The Bug)

```typescript
if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}
// Retries 400, 401, 403, 404, 500, 503...
```

**Pros:**
- Simple: any failure triggers retry

**Cons:**
- Wastes resources on permanent failures
- Delays user feedback on client errors
- Violates HTTP semantics

**Why we chose B (intentional bug):** The bug simulates the naive approach. The correct approach (A) requires understanding HTTP semantics.

---

## Decision 4: AbortController vs setTimeout Rejection

### Option A: AbortController (What We Chose)

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);
const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);
```

**Pros:**
- Cancels the actual HTTP request
- Frees up network resources
- Standard Web API

**Cons:**
- `fetch()` may not abort immediately in all Node.js versions
- Slightly more code

### Option B: Promise.race with Timeout

```typescript
const response = await Promise.race([
  fetch(url),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  ),
]);
```

**Pros:**
- Simpler code
- Works with any Promise

**Cons:**
- Doesn't cancel the underlying request
- Request continues running in background (zombie)
- Can cause unhandled rejections

**Why we chose A:** AbortController properly cancels the request. This is critical for resource management.
