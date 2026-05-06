# Requirements: Retry Logic

## Functional Requirements

1. **Automatic Retry**: Retry failed requests up to 3 times.

2. **Exponential Backoff**: Delays of 1s, 2s, 4s between retries.

3. **Jitter**: Add randomness to delays to prevent thundering herd.

4. **Smart Retries**: Only retry on 5xx errors and timeouts, NOT 4xx.

5. **Timeout**: Fail if request takes longer than timeout.

## API Requirements

- `GET /fetch?url=...` - Fetch URL with retry logic

## Non-Functional Requirements

- Jitter prevents synchronized retries
- Total retry duration is bounded
- Idempotent operations are safe
- Minimal overhead on success

## Acceptance Criteria

- [ ] Succeeds on first try when service is healthy
- [ ] Retries 3 times on 5xx errors
- [ ] Does NOT retry on 4xx errors
- [ ] Uses exponential backoff (1s, 2s, 4s)
- [ ] Adds jitter to delays
- [ ] Times out slow requests
- [ ] Returns error after exhausting retries
