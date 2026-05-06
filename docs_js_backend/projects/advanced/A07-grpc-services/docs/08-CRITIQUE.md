# Critic Review

## Technical Review
A senior distributed systems engineer would say:

- **"No mTLS. In production, every gRPC connection must be encrypted and authenticated."**
  `grpc.credentials.createInsecure()` sends plaintext. Anyone on the network can intercept protobuf traffic. Use `grpc.credentials.createSsl()` with mutual TLS certificates.

- **"No health checks. Kubernetes can't tell if a service is ready or alive."**
  gRPC provides a standard health-checking protocol (`grpc.health.v1.Health`). Without it, a load balancer might route to a starting (not ready) or dead (not live) pod.

- **"No circuit breaker. If OrderService is persistently down, the gateway should fail fast instead of trying every time."**
  Retries help transient failures. For persistent failures (10 consecutive errors), a circuit breaker should open and return `503 Service Unavailable` immediately for 30 seconds.

- **"No request ID propagation. Can't trace a request across services."**
  The gateway generates a request ID. It must inject it into gRPC metadata (`x-request-id`). The UserService and OrderService must log it. Without this, debugging production issues is guesswork.

- **"No proto versioning strategy. How do you deploy v2 without breaking v1 clients?"**
  The `order_v1.proto` vs `order.proto` bug demonstrates the danger. A real system uses a schema registry (Buf Schema Registry, Confluent Schema Registry) and CI checks.

- **"No interceptor-based middleware."**
  Logging, metrics, auth, and tracing should be gRPC interceptors (middleware), not copy-pasted into every handler.

## Security Review

- **Man-in-the-Middle**: gRPC without TLS is plaintext. Wireshark can dissect protobuf if it has the `.proto` file.
- **Authorization**: No auth tokens on gRPC calls. Any service can call any method. In production, attach JWTs to gRPC metadata.
- **Injection**: Protobuf is binary, so SQL injection isn't possible at the transport layer. But business logic injection is (e.g., negative `total_cents`). Validate in handlers.
- **Resource Exhaustion**: No rate limiting on the gateway. A malicious client could stream `ListUsers` indefinitely.

## Educational Review

- **What's missing**: Interceptors (middleware for gRPC). The project should demonstrate a logging interceptor.
- **What's confusing**: The difference between `grpc.credentials.createInsecure()` and `createSsl()` isn't explained in comments. Many beginners copy-paste `createInsecure()` into production.
- **What's excellent**: The intentional bugs are realistic. The proto mismatch bug in particular teaches a lesson that many production engineers learn the hard way.
- **Suggested addition**: A `docker-compose` setup that demonstrates round-robin load balancing across 3 OrderService instances. Show how retries work during a rolling restart.
- **Suggested addition**: A chapter on gRPC streaming backpressure. Show how a slow consumer naturally throttles a fast producer via HTTP/2 flow control windows.

## Fixes Applied in This Revision
- Added `order_v1.proto` to demonstrate the mismatch bug explicitly.
- Added `closeClients()` for graceful shutdown (prevents stream leaks on SIGTERM).
- Added streaming RPC examples (`ListUsers`, `ListUserOrders`) with proper `call.end()`.
- Added service config examples for retry and load balancing.

## Grade: B+
Solid introduction to gRPC with realistic failure modes. Missing production hardening (TLS, health checks, interceptors, circuit breakers) but appropriate for an educational project. The bugs are the star of the show.
