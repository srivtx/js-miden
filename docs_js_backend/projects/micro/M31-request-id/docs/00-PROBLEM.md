# M31: HTTP Request ID Middleware

## WHAT
A middleware that generates a unique request identifier (UUID v4) for every incoming HTTP request, attaches it to the response header `X-Request-ID`, includes it in every log line, and propagates it to downstream services.

## WHY
Distributed systems require correlation IDs to trace a single transaction across multiple services, logs, and databases. Without request IDs, debugging production issues across log streams is nearly impossible.

## Constraints
- Must use UUID v4 for uniqueness
- Must attach to response header `X-Request-ID`
- Must propagate via `X-Request-ID` header to downstream calls
- Every log line must include the request ID
- Must be framework-agnostic within Express middleware pattern
