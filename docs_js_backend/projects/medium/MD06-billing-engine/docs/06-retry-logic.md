# Retry Logic

## Why Retry?
Payment gateways, databases, and external APIs fail intermittently. Retries recover from transient failures without user intervention.

## When NOT to Retry

| Failure | Retry? | Reason |
|---|---|---|
| `card_declined` | No | Card is invalid; retrying will fail again |
| `expired_card` | No | Customer must update card |
| `insufficient_funds` | Yes (with backoff) | Customer may have funds later |
| `rate_limit` | Yes | Gateway is overloaded |
| `timeout` | Yes | Request may have succeeded; use idempotency |
| `500 Internal Server Error` | Yes | Transient server error |

## Exponential Backoff with Jitter

```
Attempt 1: wait 0s
Attempt 2: wait 2s  + random jitter
Attempt 3: wait 4s  + random jitter
Attempt 4: wait 8s  + random jitter
Attempt 5: wait 16s + random jitter
Attempt 6: wait 32s + random jitter
Max wait:  60s (capped)
```

```typescript
function exponentialBackoff(attempt: number, baseMs = 2000, maxMs = 60000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  const jitter = Math.random() * exponential * 0.3; // 30% jitter
  return Math.floor(exponential + jitter);
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  shouldRetry?: (error: any) => boolean
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxAttempts) throw error;
      if (shouldRetry && !shouldRetry(error)) throw error;

      const delay = exponentialBackoff(attempt);
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}
```

## Circuit Breaker

If a service fails repeatedly, stop calling it temporarily to prevent cascading failures.

```
Closed  ──failure──▶  Open  ──timeout──▶  Half-Open  ──success──▶  Closed
  │                     │                  │
  │                     │                  │
 requests pass    requests fail       test request
```

```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private nextAttempt: number = 0;

  constructor(
    private threshold = 5,
    private timeoutMs = 60000
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeoutMs;
    }
  }
}
```

## Retry in Dunning (Failed Payments)

```typescript
const DUNNING_SCHEDULE = [
  { days: 1,  email: 'payment_failed' },
  { days: 3,  email: 'payment_retry' },
  { days: 7,  email: 'payment_final_notice' },
  { days: 14, action: 'cancel_subscription' },
];

async function scheduleDunning(subscriptionId: string) {
  for (const step of DUNNING_SCHEDULE) {
    const runAt = new Date();
    runAt.setDate(runAt.getDate() + step.days);

    await db.dunningJob.create({
      data: {
        subscriptionId,
        scheduledAt: runAt,
        action: step.action || 'send_email',
        emailTemplate: step.email,
      },
    });
  }
}
```

## Real Breach Story: Stripe API Timeout (2019)
In 2019, a merchant's retry logic lacked idempotency. When Stripe's API timed out, the merchant's system retried the charge 12 times in 30 seconds, resulting in **12 duplicate charges** on the customer's card.

**Lesson**: Always combine retries with **idempotency keys**.

## OWASP Reference

> "Implement retry logic with exponential backoff and jitter for transient failures. Combine retries with idempotency to prevent duplicate operations." — OWASP Resilience Cheat Sheet

> "Use circuit breakers to prevent cascading failures in distributed systems." — OWASP API Security Top 10
