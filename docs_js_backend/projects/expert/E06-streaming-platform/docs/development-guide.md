# E06 Streaming Platform — Development Guide

## Code Style
- TypeScript ESM with strict mode
- Express 5 with async error handling
- Shared JWT secret across services for Phase 1 simplicity

## Adding a Service
1. Create directory with `src/`, `tests/`, `Dockerfile`
2. Add to `docker-compose.yml` with unique port
3. Update this documentation

## Cross-Service Calls
Example from stream-service to subscription-service:
```ts
const sub = await fetch('http://subscription-service:4007/subscriptions/user/' + userId);
```

## Idempotency
Transcode jobs use deterministic job IDs. Re-submitting the same uploadId should return the existing job (enhancement for Phase 2).

## Environment
Keep secrets out of code. Use `.env` and Docker secrets in production.
