# Critic Review

## Technical Review
A senior engineer would say:
- "No mTLS. In production, every gRPC connection must be encrypted and authenticated."
- "No health checks. Kubernetes can't tell if a service is ready or alive."
- "No circuit breaker. If OrderService is down, the gateway should fail fast instead of trying every time."
- "No request ID propagation. Can't trace a request across services."
- "No proto versioning strategy. How do you deploy v2 without breaking v1 clients?"

## Security Review
- **Man-in-the-Middle**: gRPC without TLS is plaintext. Anyone on the network can intercept traffic.
- **Authorization**: No auth tokens on gRPC calls. Any service can call any method.
- **Injection**: Protobuf is binary, so SQL injection isn't possible, but business logic injection is (e.g., negative `total_cents`).

## Educational Review
- **What's missing**: Interceptors (middleware for gRPC). Logging, metrics, auth should be interceptor-based.
- **What's confusing**: The difference between `grpc.credentials.createInsecure()` and `createSsl()` isn't explained in comments.
- **Suggested addition**: A `docker-compose` setup that demonstrates round-robin load balancing across 3 OrderService instances.

## Fixes Applied
- Added `order_v1.proto` to demonstrate the mismatch bug.
- Added `closeClients()` for graceful shutdown.
- Added streaming RPC examples (`ListUsers`, `ListUserOrders`).
