# Research Notes

## Primary Sources

1. **gRPC Documentation — Deadlines, Timeouts, and Retries**
   https://grpc.io/docs/guides/deadlines/
   Key finding: Deadlines are propagated automatically across nested RPCs. A parent deadline of 5s becomes 4.8s after 200ms of local processing.

2. **Protocol Buffers Language Guide — Updating Message Types**
   https://protobuf.dev/programming-guides/proto3/#updating
   Key finding: Never change the wire type of an existing field number. Never reuse a field number after deletion. Use `reserved`.

3. **HTTP/2 RFC 7540 — Hypertext Transfer Protocol Version 2**
   https://datatracker.ietf.org/doc/html/rfc7540
   Key finding: HTTP/2 multiplexes up to 2^31 streams per connection with binary framing and HPACK header compression. gRPC is essentially a specialization of HTTP/2.

4. **Google SRE Book — "Addressing Cascading Failures"**
   Beyer, B., et al. *Site Reliability Engineering*. O'Reilly, 2016.
   Key finding: Deadlines and load shedding are the primary defenses against cascade failures. Every RPC must have a deadline; every service must shed load when overloaded.

5. **gRPC Load Balancing Guide**
   https://grpc.io/docs/guides/load-balancing/
   Key finding: gRPC prefers client-side load balancing ("thick client") over L4 proxies because it understands RPC-level health, not just TCP health.

## Academic Papers

6. **Varda, K. "Protocol Buffers: Google's Data Interchange Format." Google, 2008.**
   Original design rationale for protobuf. Emphasizes forward/backward compatibility as a first-class requirement.

## Industry Standards & Best Practices

7. **CNCF Cloud Native Trail Map — Service Mesh**
   https://landscape.cncf.io/
   Context: gRPC is the default RPC framework for Kubernetes-native applications. Istio/Linkerd provide mTLS, retry, and observability as a mesh layer.

## Latest Trends (2025)

8. **Connect RPC**
   https://connectrpc.com/
   A simpler alternative to gRPC that works over HTTP/1.1 and HTTP/2. Uses standard `fetch()` in browsers without a proxy. Growing adoption for web-facing APIs.

9. **buf.build**
   https://buf.build/
   Protobuf linting, breaking change detection, and code generation as a service. Enforces proto best practices in CI.

10. **gRPC Reflection**
    https://github.com/grpc/grpc/blob/master/doc/server-reflection.md
    Server exposes its proto schema at runtime. Enables dynamic clients like `grpcurl` without proto files. Essential for debugging.

## Benchmarks

| Metric | gRPC (protobuf) | REST (JSON) | Factor |
|--------|----------------|-------------|--------|
| Unary latency (same DC) | ~0.3ms | ~1.5ms | 5x faster |
| Serialization speed | ~5x | baseline | 5x faster |
| Payload size | ~3x smaller | baseline | 3x smaller |
| Streaming throughput | ~1M msg/s/core | ~50K msg/s/core | 20x faster |
| Connection overhead | 1 TCP for N RPCs | 1 TCP per RPC | Nx less |

## Industry Adoption

- **Google**: Invented gRPC and Protocol Buffers. All internal services use Stubby (gRPC's predecessor) with mandatory deadlines. The 2017 outage described in BUGS.md directly led to stricter deadline enforcement.
- **Netflix**: gRPC for internal APIs, REST for external. Strict proto compatibility checks in CI using `buf`. Every proto change requires approval from 2 teams.
- **Uber**: Peloton (their orchestrator) uses gRPC with custom load balancing. Published extensively on retry policies and circuit breakers.
- **Square**: Cash App uses gRPC for all internal services. Maintains `protoc-gen-grpc-web` for browser clients.
- **Lyft**: Envoy proxy was built specifically to bridge gRPC and HTTP/1.1 worlds. Now a CNCF graduated project.
