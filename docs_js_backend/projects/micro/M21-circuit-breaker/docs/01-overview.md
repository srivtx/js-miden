# Overview: Circuit Breaker

The Circuit Breaker pattern prevents cascading failures in distributed systems by monitoring the health of external service calls and automatically failing fast when a service is unhealthy.

## Project Goal

Build a circuit breaker that wraps HTTP API calls, tracks failures, and transitions between closed, open, and half-open states to protect both the caller and the downstream service.

## Learning Outcomes

After completing this project, you will understand:
- State machine design for fault tolerance
- Failure detection and thresholding
- Recovery mechanisms and half-open probing
- Timeout handling to prevent indefinite hangs
- Metrics and observability for circuit health

## Real-World Context

Circuit breakers are used in microservices architectures (Netflix Hystrix, Resilience4j, Polly), API gateways, and any system that calls external services. They are essential for building resilient distributed systems.

## File Structure

```
src/
  index.ts            - Express server
  circuit-breaker.ts  - Core circuit breaker implementation
tests/
  circuit-breaker.test.ts - Test suite
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
