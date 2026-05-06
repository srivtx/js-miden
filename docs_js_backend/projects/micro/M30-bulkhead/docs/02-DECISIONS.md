# 02-DECISIONS: Bulkhead Pattern

## WHAT decisions were made?

1. **Semaphore-style pool with explicit acquire/release**
2. **Rejection on capacity exhaustion (no queueing)**
3. **Express routes as workload type boundaries**

## WHY these decisions?

### Decision 1: Semaphore-Style Pool

**Pros:**
- Simple to understand and implement.
- Works with any async function.

**Cons:**
- Manual `acquire`/`release` is error-prone (must use `try/finally`).
- No automatic timeout on held slots.

**Alternatives:**
- **Promise pool library (p-limit, async-sema)**: Pre-built, battle-tested.
  - *Pros:* Less code, handles edge cases, better error handling.
  - *Cons:* Adds dependency.
- **Worker threads / thread pools**: True OS-level isolation.
  - *Pros:* CPU isolation; one workload can't starve another of CPU.
  - *Cons:* More complex, higher memory overhead.
- **Verdict:** Semaphore is fine for I/O-bound work. For CPU isolation, use worker threads or separate processes.

### Decision 2: Rejection Instead of Queueing

**Pros:**
- Fails fast; client knows immediately.
- Prevents memory exhaustion from queue growth.
- Forces callers to implement backpressure.

**Cons:**
- Bursty traffic may see transient rejections.
- Requires clients to handle 503 gracefully.

**Alternative:** Bounded queue with timeout
- **Pros:* Smoother handling of bursts.
- **Cons:* Hides latency; queues can still grow under sustained load.
- **Verdict:** Rejection is preferred for bulkheads. The whole point is to protect resources, not buffer indefinitely.

### Decision 3: Express Routes as Boundaries

**Pros:**
- Natural mapping: `/critical` → critical pool, `/background` → background pool.
- Easy to test with HTTP clients.

**Cons:**
- Workload type is determined by URL, not by request metadata.
- Not all systems are HTTP-based.

**Alternative:** Decorator / wrapper function
- **Pros:** Works in any context (message queues, gRPC, background jobs).
- **Cons:** Requires discipline to apply consistently.
- **Verdict:** Express routes are fine for a demo. In production, use a bulkhead library integrated with your framework.

## WRONG vs RIGHT Decision-Making

| Decision | WRONG Approach | RIGHT Approach |
|----------|----------------|----------------|
| Pool implementation | "I'll write my own semaphore." | "Use a tested library like `p-limit` or `async-sema`." |
| Backpressure | "Queue requests when the pool is full." | "Reject immediately so upstream can back off." |
| Isolation level | "One pool for the whole app." | "One pool per workload type, per service, per tenant." |

## Final Recommendation

For production Node.js, use **`p-limit`** or **`async-sema`**. For JVM systems, use **Resilience4j** or **Hystrix** (deprecated, but the pattern lives on). For infrastructure-level bulkheads, use **cgroups**, **Kubernetes resource quotas**, or **AWS ECS task limits**.
