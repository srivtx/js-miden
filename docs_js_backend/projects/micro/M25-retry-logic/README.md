# M25: Retry Logic

An HTTP client with exponential backoff retry and intentional bugs to fix.

## Quick Start

```bash
npm install
npm test          # See failing tests
npm run build
npm start
```

## API

- `GET /fetch?url=...` - Fetch URL with retry logic

## Phases

### Phase 1: Basic Retry Logic
Build a client that:
- Retries failed requests up to 3 times
- Uses exponential backoff: 1s, 2s, 4s
- Adds jitter to prevent thundering herd
- Times out slow requests

### Phase 2-3: Advanced Concepts
- Idempotency checking (is retry safe?)
- Backoff strategies (linear, exponential, constant)
- Maximum retry duration
- Circuit breaker integration
- Retry-after header support

## Bugs

### Bug 1: No Jitter
All retries happen at exact intervals (1s, 2s, 4s), causing thundering herd when a service recovers.

### Bug 2: Retries on 4xx Errors
Retries client errors (400, 404) which are guaranteed to fail again, wasting resources.

## Docs

See the `docs/` folder for complete documentation.
