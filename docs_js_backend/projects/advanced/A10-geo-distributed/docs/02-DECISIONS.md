# Architecture Decisions

## Decision 1: Consistency Model

### Option A: Strong Consistency (CP)
**Pros:** Every read sees the latest write. No conflicts. Simple mental model.
**Cons:** Requires consensus (Paxos/Raft) for every write. Cross-region latency 100-300ms. Unavailable during partitions.

### Option B: Eventual Consistency (AP)
**Pros:** Low latency (~10ms local write). Available during partitions. Scales linearly with regions.
**Cons:** Conflicts possible. Application must handle concurrent updates. Stale reads.

### Option C: Causal Consistency
**Pros:** Preserves causal relationships (if A happens before B, all nodes see A before B).
**Cons:** Still allows concurrent writes. More complex than eventual consistency.

### What We Chose: Eventual Consistency (AP)
**Why:** For a global user-facing API, availability and low latency trump strong consistency. Users prefer a slightly stale cart to an error page.

---

## Decision 2: Conflict Detection Mechanism

### Option A: Wall-Clock Timestamps
**Pros:** Simple, no extra metadata.
**Cons:** Clock skew causes incorrect ordering. NTP can drift by 10-100ms. "Last write" may not actually be last.

### Option B: Vector Clocks
**Pros:** Precise causality tracking. Detects true concurrency. No dependency on synchronized clocks.
**Cons:** Metadata overhead (one integer per region). Complex merge logic.

### Option C: Dotted Version Vectors
**Pros:** More compact than vector clocks for many actors. Supports actor eviction.
**Cons:** Complex to implement and reason about.

### Option D: CRDTs (Conflict-free Replicated Data Types)
**Pros:** Automatic, correct merge for supported data types (counters, sets, maps).
**Cons:** Limited to specific data types. Custom business logic requires custom CRDTs.

### What We Chose: Vector Clocks with Application-Level Merge
**Why:** Vector clocks are the gold standard for causality tracking. They teach fundamental distributed systems concepts. CRDTs are better for production but hide the complexity.

---

## Decision 3: Routing Strategy

### Option A: DNS-Based (GeoDNS / Latency-Based)
**Pros:** Zero application code. Uses Route 53, Cloudflare, or Google Cloud DNS.
**Cons:** Coarse-grained (region-level only). No session stickiness. DNS caching can pin users to wrong regions.

### Option B: Application-Level Routing
**Pros:** Fine-grained control. Session stickiness. Dynamic failover based on real-time health.
**Cons:** Requires client-side or proxy-side logic. Latency measurement overhead.

### What We Chose: Application-Level with DNS Fallback
**Why:** The project demonstrates measuring RTT to each region and pinning users. In production, this would be augmented with GeoDNS for the initial connection.

---

## Decision 4: Replication Strategy

### Option A: Synchronous (Quorum)
**Pros:** Stronger consistency. Write acknowledged by majority.
**Cons:** High latency. Unavailable if majority is unreachable.

### Option B: Asynchronous (Fire-and-Forget)
**Pros:** Lowest latency. Write acknowledged immediately.
**Cons:** Highest conflict rate. No durability guarantee until replication completes.

### Option C: Asynchronous with Acknowledgment
**Pros:** Write acknowledged locally, then asynchronously replicated with retry.
**Cons:** Still eventual consistency. Requires durable queue (Redis Stream, Kafka).

### What We Chose: Asynchronous with In-Memory Queue
**Why:** For educational scope, an in-memory pending replication queue is sufficient. Production systems use Redis Streams, Kafka, or DynamoDB Global Tables.
