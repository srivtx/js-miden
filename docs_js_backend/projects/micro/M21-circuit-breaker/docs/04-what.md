# WHAT: Circuit Breaker

## Definition

A circuit breaker is a design pattern that monitors the health of external service calls and automatically prevents the application from performing operations that are likely to fail.

## The Three States

### Closed (Normal Operation)
- All requests pass through to the external service
- Failures are counted
- If failures exceed threshold within time window → transition to Open

### Open (Failing Fast)
- All requests fail immediately with error (e.g., 503)
- No calls reach the external service
- After timeout period → transition to Half-Open

### Half-Open (Probing Recovery)
- One test request is allowed through
- If successful → transition to Closed
- If failure → transition back to Open

## Real-World Analogy

Like an electrical circuit breaker in your home:
- Normal: Current flows (closed)
- Overload: Breaker trips (open)
- Reset: You flip the switch to test (half-open)

## Key Metrics

- **Failure Rate**: failures / total requests
- **Latency**: Time to detect failure
- **Recovery Time**: Time from open to half-open
- **Success Rate in Half-Open**: Probes that succeed
