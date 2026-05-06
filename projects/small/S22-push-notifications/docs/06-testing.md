# 06-testing.md

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner with supertest.

## Test Coverage

- **Token registration** — stores platform and user metadata
- **Single send** — delivers to valid tokens
- **Validation** — rejects invalid/short tokens before sending
- **Batch performance** — 10 notifications should complete in < 200ms

## Failing Tests

Two tests intentionally fail due to Phase 1 bugs:

1. `should reject invalid tokens before sending` — sends to any token without validation
2. `should batch send efficiently` — batch endpoint processes sequentially, no real batching

## Fixing

1. Add `isValidToken()` check and reject bad tokens with 400
2. Use provider batch APIs (FCM multicast, APNS HTTP/2 multiplexing)
3. Parallelize independent provider calls with `Promise.all`
