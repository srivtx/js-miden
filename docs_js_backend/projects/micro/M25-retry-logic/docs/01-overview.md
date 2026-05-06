# Overview: Retry Logic

Retry logic with exponential backoff and jitter is essential for handling transient failures in distributed systems without overwhelming recovering services.

## Project Goal

Build an HTTP client that automatically retries failed requests with exponential backoff and jitter, while respecting idempotency and avoiding retries on permanent failures.

## Learning Outcomes

After completing this project, you will understand:
- Exponential backoff strategies
- Jitter to prevent thundering herd
- Idempotency and safe retry conditions
- Timeout handling
- Integration with circuit breakers

## Real-World Context

Retry logic is built into AWS SDK, gRPC, Axios, Fetch API wrappers, and every resilient HTTP client. AWS recommends exponential backoff with jitter for all API calls.

## File Structure

```
src/
  index.ts        - Express server
  retry-logic.ts  - Core retry client
tests/
  retry-logic.test.ts - Test suite
docs/
  01-overview.md
  02-requirements.md
  03-architecture.md
  04-what.md
  05-why.md
  06-how.md
  07-wrong-vs-right.md
  08-testing.md
  09-bugs.md
```
