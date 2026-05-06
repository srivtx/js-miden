# Architecture: Retry Logic

## Components

### RetryClient
- Configurable max retries, delays, timeouts
- Executes fetch with retry logic
- Computes backoff with jitter

### Backoff Strategy
- Base delay: 1 second
- Multiplier: 2 (exponential)
- Max delay: 16 seconds
- Jitter: Random 0-100% of delay

### Retry Conditions
- Retry: 5xx errors, timeouts, network errors
- No retry: 4xx errors (client mistake)

### Express Routes
- `GET /fetch?url=...` - Fetch with retry

## Retry Flow

```
attempt 0: try fetch
  success → return
  4xx → fail immediately
  5xx/timeout → wait 1s + jitter

attempt 1: try fetch
  success → return
  5xx/timeout → wait 2s + jitter

attempt 2: try fetch
  success → return
  5xx/timeout → wait 4s + jitter

attempt 3: try fetch
  success → return
  fail → throw error
```

## Jitter Formula

```typescript
const delay = Math.min(
  baseDelay * Math.pow(2, attempt),
  maxDelay
);
const jitter = Math.random() * delay;
const totalDelay = delay + jitter; // or delay / 2 + jitter
```

AWS recommends "equal jitter":
```typescript
const totalDelay = (delay / 2) + (Math.random() * delay / 2);
```

## Integration Points

- **Circuit Breaker**: Don't retry if circuit is open
- **Idempotency**: Only retry safe operations (GET, PUT with idempotency key)
- **Timeout**: Each attempt has its own timeout
