# The Problem

## What Are We Building?
Two gRPC microservices (User and Order) communicating over HTTP/2, with an Express gateway translating HTTP REST to gRPC.

## Why Does This Problem Exist?
REST JSON APIs are human-readable but inefficient for service-to-service communication. gRPC uses binary protobuf over HTTP/2, giving us streaming, multiplexing, and strong typing.

## Who Will Use It?
- **Frontend Clients**: Call the HTTP gateway.
- **Internal Services**: Call each other directly via gRPC.
- **Mobile Apps**: Benefit from smaller payloads and binary encoding.

## Constraints
- **Time**: Unary RPC < 10ms p99 within the same datacenter.
- **Scale**: Support 10K concurrent streams per HTTP/2 connection.
- **Correctness**: Proto contracts must be backward-compatible.
- **Reliability**: Deadlines and retries on every call.

## What We're NOT Building
- We are NOT building a service mesh (Istio/Linkerd).
- We are NOT building proto reflection or a dynamic proxy.
- We are NOT building mTLS (though you should in production).
