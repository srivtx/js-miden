# M05 Rate Limiter: Impossible Constraints

## Constraint 1: "It Must Be Perfectly Accurate, But Use O(1) Memory"

### Why It Sounds Impossible
A perfectly accurate sliding window stores every request timestamp (O(R) memory). An O(1) solution like a fixed window is inaccurate at boundaries.

### The Solution: Approximate Sliding Window
Store only two counters: current window and previous window.

```
current_window = floor(now / W)
elapsed = now % W
weight = (W - elapsed) / W
estimated = current_count + (previous_count * weight)
```

**Accuracy:** Within 1-2% of true count.
**Memory:** O(1) — two counters per client.

Redis implementation:
```redis
GET ratelimit:ip:current   → 7
GET ratelimit:ip:previous  → 4
estimated = 7 + 4 * 0.3 = 8.2
```

> Perfect accuracy is a luxury. Approximate correctness at scale is engineering.

---

## Constraint 2: "It Must Work Across 100 Servers, But Be Atomic"

### Why It Sounds Impossible
Atomic operations require a single agent of execution. 100 servers means 100 agents.

### The Solution: Redis as Centralized Atomic Engine
Redis is single-threaded. It processes one command at a time across all clients. By making Redis the counter, you outsource atomicity.

```javascript
// 100 servers, 1 million req/s — all funneled through Redis INCR
const count = await redis.incr(`ratelimit:${ip}`);
```

**Scaling Redis:**
- **Primary + Replica:** Read from replicas, write to primary.
- **Redis Cluster:** Shard limits by IP hash across nodes.
- **Redis Sentinel:** Auto-failover if primary dies.

> The atomicity constraint does not require one server. It requires one **arbiter**. Redis is that arbiter.

---

## Constraint 3: "It Must Survive a Redis Outage Without Blocking Legitimate Users"

### Why It Sounds Impossible
If Redis is down, you cannot check or update counters. Fail closed = outage. Fail open = abuse.

### The Solution: Tiered Defense + Local Fallback

**Layer 1: Edge Rate Limiting (nginx/Envoy)**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
```
This lives on the load balancer. It does not need Redis.

**Layer 2: Application Rate Limiting (Redis-backed)**
Fine-grained, per-endpoint, per-user. If Redis fails:
- Return 200 with a warning header.
- Alert the on-call engineer.
- Rely on Layer 1 for coarse protection.

**Layer 3: Local In-Memory Fallback**
```javascript
let localFallback = new Map();

try {
  count = await redis.incr(key);
} catch (err) {
  // Redis down. Use local memory as emergency brake.
  count = (localFallback.get(ip) || 0) + 1;
  localFallback.set(ip, count);
  if (count > 100) return res.status(429).send('Emergency limit');
}
```

> Defense in depth means no single component failure destroys your availability.

---

## Constraint 4: "It Must Limit by User, But I Have No Authentication"

### Why It Sounds Impossible
Rate limiting by user requires knowing who the user is. No auth = no identity.

### The Solution: Fingerprinting + Progressive Enforcement
Use what you have:
- IP address (coarse)
- User-Agent + IP hash (slightly finer)
- TLS fingerprint (harder to spoof)

Progressive strategy:
1. **First 100 requests:** Allow based on IP.
2. **Next 1000 requests:** Require a free API key.
3. **Beyond that:** Require authenticated account.

This is not perfect, but it raises the attacker's cost. A scraper must now:
- Rotate IPs (cost: proxy services)
- Rotate TLS fingerprints (cost: complexity)
- Register accounts (cost: CAPTCHA, email verification)

> Security is not about perfect prevention. It is about **making abuse more expensive than it is worth**.

---

## Constraint 5: "It Must Handle a Million Requests Per Second"

### Why It Sounds Impossible
A single Redis node handles ~100k ops/sec. A million requires 10 nodes just for rate limiting.

### The Solution: Probabilistic Counting + Edge Caching
- **Count-Min Sketch:** A probabilistic data structure that estimates frequency in O(1) time with sub-linear memory. Used by Cloudflare.
- **Bloom Filters:** Track "has this IP ever been seen?" in tiny memory.
- **Edge caching:** CDN-level rate limiting (Cloudflare, Fastly, AWS CloudFront) absorbs 99% of traffic before it reaches your origin.

For the 1% that reaches your app, a smaller Redis cluster is sufficient.

---

## The Meta-Pattern

Every "impossible" constraint in rate limiting is solved by the same realization:

> **You do not need one perfect solution. You need layers of good-enough solutions that compose into a resilient system.**

Accuracy, availability, and scale are not mutually exclusive if you stop looking for a silver bullet and start building a fortress.
