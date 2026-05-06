# THINKING: Retry Logic

## Mental Models

### The Polite Guest Model

Imagine you're knocking on a friend's door:
- **First knock**: Normal volume, normal interval
- **No answer**: Wait a bit, knock again (louder? No, just wait longer)
- **Still no answer**: Wait even longer, knock one more time
- **Definitely not home**: Stop knocking and go home (don't break the door)

Retry logic is the same. You don't bang on the door every second (no jitter, no backoff). You don't keep knocking for an hour (max retries). And you don't break in when they say "go away" (4xx errors).

### The Highway Traffic Model

When an accident clears on a highway:
- **Without jitter**: All cars accelerate at exactly the same moment → second accident (thundering herd)
- **With jitter**: Cars accelerate at slightly different times → smooth flow

Jitter in retry logic serves the same purpose: preventing synchronized surges.

### The Negotiation Model

Retry logic is a negotiation with reality:
- "Please work" → 503
- "Please work (I'll wait a bit)" → 503
- "Please work (I'll wait longer)" → 503
- "Okay, I give up" → throw error

The key is knowing when to keep asking and when to accept defeat.

## Hot Path (What Happens on Every Request)

```
fetch(url)
    |
    v
[Create AbortController]
    |
    v
[Set timeout] --fires?--> [Abort, throw] --> [Retry?]
    |
    v
[Execute fetch]
    |
    v
[Check response] --4xx?--> [Throw, NO retry]
    |                            |
    v                            v
 [5xx/timeout]                  Done
    |
    v
[Calculate delay] --with jitter?--> [Sleep] --> [Retry loop]
```

The hot path must distinguish between retryable and non-retryable errors immediately.

## Danger Zones

### 1. Retrying 4xx Errors (Our Bug)

4xx errors indicate client mistakes:
- 400: Bad request (your payload is malformed)
- 401: Unauthorized (your credentials are wrong)
- 403: Forbidden (you don't have permission)
- 404: Not found (the resource doesn't exist)
- 422: Unprocessable entity (validation failed)

Retrying these is like resending a letter to a non-existent address. It wastes resources and delays the inevitable failure response.

### 2. No Jitter (Our Bug)

Without jitter, all clients retry at exactly the same intervals:
```
T+0s:  Service fails
T+1s:  1000 clients retry simultaneously
T+3s:  1000 clients retry simultaneously
T+7s:  1000 clients retry simultaneously
```

The recovering service is overwhelmed by synchronized traffic spikes.

### 3. Unbounded Retries

Without `maxRetries`, a permanently failing service would be retried forever:
```
while (true) {
  try { return await fetch(url); }
  catch { await sleep(delay); }
}
```

This is a denial-of-service attack against yourself.

### 4. Timeout Longer Than Total Retry Budget

If `timeoutMs * (maxRetries + 1) >` your SLA, users wait too long:
```
Timeout: 30s, Retries: 5
Total worst-case wait: 30 + 30 + 30 + 30 + 30 + 30 = 180s
```

Your API gateway probably times out at 30s, so the user sees 504 while you're still retrying.

### 5. Retry Amplification

If Service A calls Service B, and both have 3 retries:
- A fails → retries 3 times
- Each A retry calls B → B retries 3 times each
- Total B requests: 3 * 3 = 9

With 3 layers: 3 * 3 * 3 = 27 requests for 1 original request.

**Mitigation:** Use circuit breakers at layer boundaries. Don't retry if a circuit is open.

## What-If Game

### What if we retry everything?

4xx errors get retried. Users wait 7+ seconds to get a 404. Load on the service increases 4x. Log noise makes debugging impossible.

### What if we have no jitter?

When a recovering service comes back online, all clients hit it simultaneously. It fails again. Clients retry again simultaneously. The system oscillates between failure and recovery indefinitely.

### What if maxRetries is too high?

Users wait 30+ seconds. Your API gateway times out first, returning 504. The retry logic continues in the background, wasting resources on a response that will never reach the user.

### What if timeout is too short?

Healthy but slow requests get aborted and retried. The service does the work multiple times. If the operation is not idempotent (e.g., charging a credit card), this causes duplicate charges.

### What if the request is not idempotent?

Retrying a POST request that creates a resource could create duplicates. Only retry idempotent operations (GET, PUT, DELETE) unless the service supports deduplication.

### What if we retry on a different server?

In a load-balanced setup, retrying the same failing server is futile. Retry should ideally target a different backend (retry on a different node).
