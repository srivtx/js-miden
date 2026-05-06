# 02-DECISIONS: Service Discovery

## WHAT decisions were made?

1. **In-memory array as the registry store**
2. **Pull-based heartbeats from services**
3. **Express REST API for registration and discovery**

## WHY these decisions?

### Decision 1: In-Memory Array

**Pros:**
- Zero latency reads.
- Simple to implement.

**Cons:**
- Lost on process restart.
- Not shared across multiple registry instances.
- Unbounded growth without cleanup.

**Alternatives:**
- **Redis**: Fast, persistent, TTL support via `EXPIRE`.
  - *Pros:* Built-in TTL, replication, shared across instances.
  - *Cons:* Adds infrastructure dependency.
- **etcd / Consul**: Distributed key-value stores designed for service discovery.
  - *Pros:* Strong consistency, watches, health checks.
  - *Cons:* Complex to operate.
- **Verdict:** In-memory is fine for a demo. Production should use Consul, etcd, or Kubernetes DNS + Endpoints.

### Decision 2: Pull-Based Heartbeats

**Pros:**
- Simple client logic: just call an endpoint.
- Registry is passive; services are responsible.

**Cons:**
- If a service crashes, it can't deregister. Must rely on TTL/cleanup.
- Network partitions can cause false evictions.

**Alternative:** Push-based health checks (registry probes services)
- **Pros:** Registry knows the truth; doesn't rely on well-behaved clients.
- **Cons:** More load on backends; harder to secure.
- **Verdict:** Pull-based heartbeats are standard (Consul, Eureka). Push-based checks are a good supplement.

### Decision 3: REST API

**Pros:**
- Universal support; any HTTP client can use it.
- Easy to debug with `curl`.

**Cons:**
- Polling for discovery is inefficient.
- JSON overhead.

**Alternative:** gRPC with bi-directional streaming
- **Pros:** Efficient binary protocol; can push updates.
- **Cons:** More complex; requires protobuf definitions.
- **Verdict:** REST is fine for learning. For high-scale discovery, consider gRPC or DNS-based discovery (Kubernetes).

## WRONG vs RIGHT Decision-Making

| Decision | WRONG Approach | RIGHT Approach |
|----------|----------------|----------------|
| Storage | "In-memory is fast, so it's best." | "Match storage to durability and scale requirements." |
| Heartbeats | "Services will deregister on exit." | "Assume services crash without warning; use TTL." |
| Protocol | "gRPC is always faster, so use it." | "Use the protocol your clients already support." |

## Final Recommendation

For production, use **Consul**, **Kubernetes DNS**, or **AWS Cloud Map**. They handle replication, TTL, health checks, and client SDKs. This code demonstrates the concept but lacks the operational rigor required for real systems.
