# A07 Evolution: v7 — Production Setup

## State of the System

The gRPC microservices are deployed as a Dockerized mesh with mTLS, health checks, circuit breakers, Envoy sidecars, and a schema registry for proto versioning.

## What Changed

- **Docker + docker-compose.** `docker-compose.yml` runs the gateway, user service, order service, and Envoy proxy.
- **mTLS.** `grpc.credentials.createSsl()` replaces `createInsecure()`. Services authenticate each other via mutual TLS certificates mounted from a Kubernetes secret.
- **Health checks.** `grpc.health.v1.Health` service provides `Check` and `Watch` RPCs. Kubernetes uses these for readiness and liveness probes.
- **Circuit breaker.** The gateway uses `opossum` to wrap gRPC calls. After 5 consecutive failures, the breaker opens for 30 seconds, returning `503 Service Unavailable` immediately.
- **Envoy sidecar.** Envoy handles gRPC-Web translation, load balancing, retries, and TLS termination. The gateway speaks HTTP/1.1 to Envoy; Envoy speaks HTTP/2 to services.
- **Proto schema registry.** `buf.build` linting and breaking-change detection run in CI. Proto files are versioned in a central registry. Services load protos from the registry at startup.
- **Deadlines and retries.** `grpc.service_config` configures 5-second deadlines and exponential backoff retries (4 attempts, 0.1s initial backoff).
- **Distributed tracing.** OpenTelemetry interceptors inject `traceparent` into gRPC metadata. Jaeger collects traces across the gateway and services.
- **Prometheus metrics.** `rpc_requests_total`, `rpc_latency_seconds`, `rpc_errors_total` with labels for `service`, `method`, and `status_code`.

## What Still Breaks

- **No database.** Services store data in memory. A restart loses all users and orders.
- **No idempotency keys.** Retried `CreateOrder` calls create duplicate orders. Idempotency keys would prevent this.
- **No saga pattern.** A failure in `CreateOrder` after `GetUser` leaves the system in an inconsistent state. Sagas would compensate.
- **No multi-cluster federation.** Services run in one Kubernetes cluster. Multi-region deployment requires service mesh federation (Istio multi-cluster).

## Code Snapshot (docker-compose.yml)

```yaml
version: '3.8'
services:
  gateway:
    build: ./gateway
    ports:
      - "3000:3000"
    environment:
      - USER_SERVICE_ADDR=user-service:50051
      - ORDER_SERVICE_ADDR=order-service:50052
      - TLS_CERT=/certs/gateway.crt
      - TLS_KEY=/certs/gateway.key
  user-service:
    build: ./user-service
    ports:
      - "50051:50051"
    volumes:
      - ./certs:/certs
  order-service:
    build: ./order-service
    ports:
      - "50052:50052"
    volumes:
      - ./certs:/certs
  envoy:
    image: envoyproxy/envoy:v1.30
    ports:
      - "9901:9901"
    volumes:
      - ./envoy.yaml:/etc/envoy/envoy.yaml
```

## Architectural Notes

This is the "production" stage. The system now has encryption, health checks, circuit breakers, and distributed tracing. The proto mismatch is prevented by a schema registry and CI checks. Retries and deadlines protect against transient failures. However, the services are still stateless and in-memory, so data durability and distributed transactions are future work.

## Future Work

1. Add PostgreSQL for durable user and order storage.
2. Add idempotency keys to `CreateOrder` for exactly-once semantics.
3. Implement the saga pattern for multi-service transactions.
4. Deploy with Istio multi-cluster for cross-region federation.
