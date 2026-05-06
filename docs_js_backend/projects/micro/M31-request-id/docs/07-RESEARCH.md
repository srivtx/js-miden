# M31: Research & Citations

## RFCs
- RFC 7329: Not directly applicable; use IETF draft on UUIDs
- RFC 7231 (HTTP/1.1 Semantics): Header field definitions

## npm Trends
- `uuid`: 200M+ downloads/week
- `pino`: 5M+ downloads/week (structured logging with request ID)
- `cls-rtracer`: 200K downloads/week (request ID via AsyncLocalStorage)

## Benchmarks
- `crypto.randomUUID()` (Node 19+): ~1M ops/sec
- `uuid.v4()`: ~800K ops/sec
- `Math.random()`-based UUIDs: Faster but non-cryptographic; avoid for security

## Best Practices
- Always propagate `X-Request-ID` (or `X-Correlation-ID`) to downstream services
- Use structured JSON logging (ECS, OpenTelemetry) for machine parsing
- Consider W3C Trace Context (`traceparent`) for modern distributed tracing
