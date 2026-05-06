# PROBLEM: Circuit Breaker

## WHAT We're Building

A production-grade circuit breaker that wraps HTTP API calls, tracks failures in a rolling time window, and automatically transitions between three states (closed, open, half-open) to prevent cascading failures in distributed systems.

## WHY This Matters

When a downstream service fails in a distributed system, callers typically block waiting for timeouts. Threads accumulate, memory exhausts, and the failure cascades upstream. A circuit breaker detects this pattern and fails fast, preserving system stability and giving downstream services time to recover.

## Constraints

1. **Failure Window**: 60 seconds rolling window
2. **Failure Threshold**: 5 failures within window triggers open state
3. **Recovery Timeout**: 30 seconds in open state before attempting half-open
4. **Request Timeout**: 5 seconds maximum per request
5. **Half-Open Limit**: Only 1 test request allowed during half-open probing
6. **Memory Bound**: Failure records older than window must be cleaned up
7. **Event-Loop Safe**: Single-threaded Node.js must not block

## Real-World Context

Circuit breakers are foundational in microservices. Netflix Hystrix pioneered the pattern (now in maintenance mode, superseded by Resilience4j). Every API gateway, service mesh, and resilient HTTP client implements this pattern. Without it, a single slow dependency can take down an entire system.

## Success Criteria

- [ ] Circuit starts closed, allowing all requests
- [ ] After 5 failures in 60s, circuit opens and returns 503 immediately
- [ ] After 30s in open state, circuit becomes half-open
- [ ] One successful request in half-open closes the circuit
- [ ] One failed request in half-open re-opens the circuit
- [ ] All requests have a 5-second timeout
- [ ] Metrics expose state and failure count for observability
