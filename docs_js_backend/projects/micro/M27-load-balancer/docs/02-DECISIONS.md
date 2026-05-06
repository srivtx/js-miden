# 02-DECISIONS: Load Balancer

## WHAT decisions were made?

1. **Round-robin algorithm for traffic distribution**
2. **In-memory backend list with HTTP health checks**
3. **Express server as the balancer frontend**

## WHY these decisions?

### Decision 1: Round-Robin

**Pros:**
- Simple to implement and understand.
- Distributes load evenly over time.

**Cons:**
- Ignores backend capacity and current load.
- Can send two heavy requests to the same backend.

**Alternatives:**
- **Least Connections**: Route to the backend with the fewest active requests.
  - *Pros:* Better for long-lived connections; accounts for current load.
  - *Cons:* Requires tracking state; more complex.
- **Weighted Round-Robin**: Give more powerful backends a higher share.
  - *Pros:* Accounts for heterogeneous hardware.
  - *Cons:* Requires manual weight tuning.
- **Random with Two Choices**: Pick two backends at random, route to the healthier one.
  - *Pros:* Simple, low state, good load distribution.
  - *Cons:* Slightly more CPU per request.
- **Verdict:** Round-robin is fine for equal-capacity backends. For production with variable load, use Least Connections.

### Decision 2: In-Memory HTTP Health Checks

**Pros:**
- Simple; no external dependencies.
- Fast to implement.

**Cons:**
- Health state is local to each balancer instance (problematic if you scale balancers).
- No shared state across a fleet of balancers.

**Alternative:** External health check service (e.g., Consul, etcd)
- **Pros:** Shared truth; works with multiple balancers.
- **Cons:** Adds infrastructure complexity.
- **Verdict:** In-memory is fine for a single-node balancer. For HA, use a distributed registry.

### Decision 3: Express Frontend

**Pros:**
- Familiar middleware model.
- Easy to add metrics, logging.

**Cons:**
- Not the fastest HTTP implementation.
- Single event loop.

**Alternative:** Raw Node.js `http.createServer`
- **Pros:** Maximum performance, minimal overhead.
- **Cons:** More code to write.
- **Verdict:** Express is acceptable for prototyping. For 10k+ RPS, consider raw Node.js, HAProxy, or Nginx.

## WRONG vs RIGHT Decision-Making

| Decision | WRONG Approach | RIGHT Approach |
|----------|----------------|----------------|
| Algorithm | "Round-robin is always best." | "Match the algorithm to the workload." |
| Health checks | "I'll check manually when things break." | "Automated, periodic health checks are mandatory." |
| State | "One balancer is enough." | "Plan for multiple balancers with shared or gossiped state." |

## Final Recommendation

For production, use **HAProxy**, **Nginx**, or a cloud load balancer (AWS ALB, GCP LB). They implement health checks, graceful draining, and sticky sessions with years of battle testing. This code is an educational implementation.
