# Research Notes

## Sources
- **gRPC Documentation**: Official guides on deadlines, retries, and load balancing. Key finding: always set deadlines.
- **Protocol Buffers Language Guide**: Field numbers, `reserved`, and backward compatibility rules. Renaming fields is a breaking change.
- **HTTP/2 RFC 7540**: Multiplexing, flow control, and stream prioritization. gRPC wouldn't exist without HTTP/2.
- **Google SRE Book, "Addressing Cascading Failures"**: Deadlines and load shedding are the primary defenses against cascade.

## Latest Trends (2025)
- **Connect RPC**: A simpler alternative to gRPC that works over HTTP/1.1 and HTTP/2. Growing adoption for browser compatibility.
- **buf.build**: Protobuf linting, breaking change detection, and code generation as a service.
- **gRPC Reflection**: Server exposes its proto schema at runtime. Enables dynamic clients like `grpcurl` without proto files.

## Benchmarks
- gRPC unary latency: ~0.3ms (same datacenter, no TLS).
- REST JSON latency: ~1.5ms (same conditions).
- gRPC streaming throughput: ~1M messages/second per core.
- Protobuf serialization: ~5x faster than JSON, ~3x smaller.

## Industry Adoption
- **Google**: Invented gRPC. All internal services use it with mandatory deadlines.
- **Netflix**: gRPC for internal APIs, REST for external. Strict proto compatibility checks in CI.
- **Uber**: Peloton (their orchestrator) uses gRPC with custom load balancing.
