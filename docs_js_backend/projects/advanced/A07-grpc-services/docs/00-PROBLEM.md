# The Problem

## What Are We Building?
A production-style microservices architecture using gRPC for inter-service communication. The system consists of a **User Service** (gRPC :50051), an **Order Service** (gRPC :50052), and an **Express 5 HTTP Gateway** (:3000) that translates REST JSON to binary protobuf RPCs over HTTP/2.

```
┌──────────────┐      REST/JSON       ┌─────────────────┐      gRPC/protobuf     ┌─────────────────┐
│   Client     │ ───────────────────► │  HTTP Gateway   │ ─────────────────────► │  User Service   │
│  (Browser)   │                      │   (Express 5)   │                      │   (gRPC :50051) │
└──────────────┘                      └─────────────────┘                      └─────────────────┘
                                             │
                                             │ gRPC/protobuf
                                             ▼
                                      ┌─────────────────┐
                                      │  Order Service  │
                                      │   (gRPC :50052) │
                                      └─────────────────┘
```

## Why Does This Problem Exist?
REST JSON APIs are human-readable but catastrophically inefficient for service-to-service communication at scale. JSON is text-based, schema-less, and transported over HTTP/1.1 which requires one TCP connection per request (or head-of-line blocking on keep-alive). gRPC uses binary Protocol Buffers over HTTP/2, giving us:
- **Streaming**: Server-streaming for large result sets (`ListUsers`, `ListUserOrders`)
- **Multiplexing**: Many RPCs share one TCP connection
- **Strong typing**: Generated TypeScript interfaces eliminate runtime schema mismatches
- **Deadlines**: Time-bounds on every RPC prevent cascading failures

## Who Will Use It?
- **Frontend Clients**: Call the HTTP gateway using familiar REST conventions
- **Internal Services**: Call each other directly via gRPC for lowest latency
- **Mobile Apps**: Benefit from smaller payloads (protobuf is ~3x smaller than JSON) and binary encoding
- **Platform Engineers**: Monitor inter-service health via gRPC status codes and deadlines

## Constraints
- **Time**: Unary RPC < 10ms p99 within the same datacenter
- **Scale**: Support 10K concurrent streams per HTTP/2 connection
- **Correctness**: Proto contracts must be backward-compatible across deployments
- **Reliability**: Deadlines and exponential-backoff retries on every call
- **Observability**: Every RPC must be traceable (request ID propagation implied)

## What We're NOT Building
- We are NOT building a service mesh (Istio/Linkerd) — only 2 services, mesh is overkill
- We are NOT building proto reflection or a dynamic proxy — clients need compiled stubs
- We are NOT building mTLS — though EVERY production gRPC deployment must use TLS
- We are NOT building a circuit breaker — the gateway retries but does not fail-fast on persistent errors

## Real-World Context
In 2017, a major cloud provider suffered a 4-hour outage because a gRPC service hung and its 12 downstream callers had no deadlines. Thread pools exhausted. The cascade took down a payment processing pipeline. This project teaches how to prevent that.
