# 06-testing.md

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner with supertest.

## Test Coverage

- **Template rendering** — variable substitution in subjects and bodies
- **Bounce detection** — emails to `bounce@` addresses fail
- **Queue behavior** — expects async return (< 50ms) and `queued` status
- **Retry logic** — bounced emails should be retried, not permanently failed

## Failing Tests

Two tests intentionally fail due to Phase 1 bugs:

1. `should return immediately with queued status` — sendEmail blocks on SMTP mock
2. `should retry bounced emails` — bounced status is permanent with no retry

## Fixing

1. Queue emails in Redis/memory and return 202 immediately
2. Process queue in background worker
3. Increment `attempts` and retry bounced emails up to 3 times
