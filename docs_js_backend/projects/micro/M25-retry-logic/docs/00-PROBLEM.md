# PROBLEM: Retry Logic

## WHAT We're Building

An HTTP client that automatically retries failed requests with exponential backoff and jitter, while correctly identifying which failures are retryable (transient) vs non-retryable (permanent).

## WHY This Matters

Networks are unreliable. DNS blips, packet loss, and temporary service overloads are normal. Without retries, a single transient failure becomes a user-facing error. With naive retries (fixed interval, no jitter), recovering services are overwhelmed by synchronized retry storms.

Proper retry logic is the difference between "99.99% uptime" and "works most of the time."

## Constraints

1. **Exponential Backoff**: Delay doubles with each retry (1s, 2s, 4s)
2. **Max Delay Cap**: Delay never exceeds 16 seconds
3. **Jitter**: Random component prevents thundering herd
4. **Timeout**: Each attempt has a 10-second timeout
5. **Max Retries**: 3 retries after the initial attempt
6. **Retryable Errors**: Only 5xx errors, timeouts, and network failures
7. **Non-Retryable Errors**: 4xx errors fail immediately
8. **AbortController**: Must cancel in-flight requests on timeout

## Real-World Context

Retry logic is built into AWS SDK, gRPC, Axios, and every resilient HTTP client. AWS explicitly recommends exponential backoff with jitter for all API calls. In 2012, a thundering herd of retries contributed to the AWS US-East outage. In 2020, Shopify's checkout system was protected by proper retry logic during a major traffic spike.

## Success Criteria

- [ ] Succeeds on first try when service is healthy
- [ ] Retries on 5xx errors with exponential backoff
- [ ] Retries on request timeouts
- [ ] Does NOT retry on 4xx errors (fails immediately)
- [ ] Adds jitter to retry delays
- [ ] Respects max delay cap
- [ ] Uses AbortController for timeout cancellation
