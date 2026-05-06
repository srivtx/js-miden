# WHAT: Retry Logic

## Definition

Retry logic is a resilience pattern that automatically re-executes failed operations, assuming the failure was transient and may succeed on subsequent attempts.

## When to Retry

### Retryable Failures
- 5xx server errors
- Network timeouts
- Connection refused (temporary)
- Rate limiting (429 with Retry-After)

### Non-Retryable Failures
- 4xx client errors (bad request, not found)
- Authentication failures (401, 403)
- Payload too large (413)

## Backoff Strategies

1. **Fixed**: Wait same time between retries
2. **Linear**: Increase by fixed amount (1s, 2s, 3s)
3. **Exponential**: Multiply by factor (1s, 2s, 4s, 8s)
4. **Decorrelated**: Random within exponential range

## Jitter Types

- **Full Jitter**: `delay = random(0, maxDelay)`
- **Equal Jitter**: `delay = maxDelay/2 + random(0, maxDelay/2)`
- **Decorrelated**: `delay = random(baseDelay, delay * 3)`

## Key Metrics

- **Retry Rate**: % of requests that retry
- **Success Rate After Retry**: % of retries that succeed
- **Total Latency**: Time including retries
- **Thundering Herd Events**: Simultaneous retries
