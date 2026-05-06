# Requirements: Circuit Breaker

## Functional Requirements

1. **State Machine**: The circuit breaker must maintain three states:
   - **Closed**: Requests pass through normally
   - **Open**: Requests fail fast with 503
   - **Half-Open**: One test request allowed to probe recovery

2. **Failure Detection**: Track failures within a rolling time window (60 seconds).

3. **Threshold**: Open the circuit after 5 failures in the window.

4. **Recovery**: After 30 seconds in open state, transition to half-open.

5. **Timeout**: Every request through the breaker must have a timeout (5s default).

6. **Metrics**: Expose circuit state and failure count via health endpoint.

## API Requirements

- `GET /api/external` - Returns success or 503 based on circuit state
- `POST /simulate/fail` - Toggle failure simulation
- `GET /health` - Returns `{ state, metrics }`

## Non-Functional Requirements

- Thread-safe (or event-loop safe in Node.js)
- Minimal overhead on successful requests
- Observable state transitions
- Configurable thresholds and timeouts

## Acceptance Criteria

- [ ] Circuit starts closed
- [ ] 5 failures in 60s opens circuit
- [ ] 6th request returns 503 immediately
- [ ] After 30s, circuit becomes half-open
- [ ] Success in half-open closes circuit
- [ ] Failure in half-open re-opens circuit
- [ ] All requests have timeout protection
