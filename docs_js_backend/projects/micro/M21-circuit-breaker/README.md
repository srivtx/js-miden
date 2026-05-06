# M21: Circuit Breaker

A circuit breaker implementation for resilient HTTP calls with intentional bugs to fix.

## Quick Start

```bash
npm install
npm test          # See failing tests
npm run build
npm start
```

## API

- `GET /api/external` - Call external API through circuit breaker
- `POST /simulate/fail` - Toggle external API failure simulation
- `GET /health` - Circuit breaker state and metrics

## Phases

### Phase 1: Basic Circuit Breaker
Build a circuit breaker that:
- Wraps HTTP calls
- Opens after 5 failures in 60 seconds
- Returns 503 when open
- Half-opens after 30 seconds
- Allows 1 test request in half-open state

### Phase 2-3: Advanced Concepts
- Failure detection strategies
- State machine (closed/open/half-open)
- Recovery mechanisms
- Preventing cascading failures
- Integration with timeouts

## Bugs

### Bug 1: No Failure Threshold
The circuit never opens because `onFailure()` doesn't check if failures exceed the threshold.

### Bug 2: No Request Timeout
The `executeWithTimeout` exists but the timeout parameter is set to a high value, making slow APIs hang indefinitely.

## Docs

See the `docs/` folder for complete documentation.
