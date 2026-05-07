# M05 Rate Limiter: Fundamentals

## 1. What Is Rate Limiting?

Rate limiting is the practice of controlling how many requests a client can make to an API within a defined time window. It is the bouncer at the door of your service.

Without it:
- One malicious script can consume all database connections.
- A bug in a partner SDK can retry infinitely and DDoS you.
- Cloud bills explode because Lambda invocations are billed per request.

## 2. The Core Concepts

### The Window
The time period over which requests are counted. Common values:
- **1 second** — Real-time systems, gaming APIs
- **1 minute** — General REST APIs
- **1 hour** — Batch operations, analytics exports

### The Limit
Maximum requests allowed within the window. Balanced against:
- **User experience** — Too low = frustrated legitimate users.
- **Infrastructure cost** — Too high = abuse is cheap.

### The Identifier
Who are we limiting? Options:
| Identifier | Pros | Cons |
|------------|------|------|
| IP Address | No auth required | NAT sharing, spoofing, VPNs |
| User ID | Fair per-person | Requires authentication layer |
| API Key | Granular control | Key management overhead |
| Session Cookie | Simple for web | Easy to rotate, stateful |

## 3. The Algorithms

### Fixed Window Counter
Divide time into discrete buckets.

```
Window 14:00-14:59 → count = 0
Request at 14:15 → count = 1
...
Request at 14:58 → count = 10 (BLOCKED)
Window 15:00-15:59 → count = 0 (RESET)
Request at 15:00 → count = 1 (ALLOWED)
```

**Math:** `window = floor(now / W)`, allow if `count[window] < R`.

**Problem:** Boundary burst. 10 requests at 14:59:59 + 10 at 15:00:00 = 20 requests in 1 second.

---

### Sliding Window Log
Store the exact timestamp of every request. Before allowing, remove timestamps older than `now - W`, then count.

**Math:**
- `S` = set of request timestamps for client
- Remove all `s` where `s < now - W`
- Allow if `|S| < R`

**Accuracy:** Perfect.
**Cost:** O(R) memory and time per request.

---

### Sliding Window Counter (Approximate)
Combine current window count with a weighted fraction of the previous window.

```
weight = (W - elapsed) / W
estimated = current_count + (previous_count * weight)
```

**Accuracy:** Good enough for most APIs.
**Cost:** O(1) memory.

---

### Token Bucket
- Bucket holds at most `B` tokens.
- Tokens refill at rate `r = R / W` per second.
- Each request consumes 1 token.
- If no tokens remain, block.

**Why use it:** Allows bursts up to `B`, then throttles to steady rate `r`. Perfect for APIs where users open an app and need 20 requests immediately, then 1 per second.

## 4. Redis Data Structures for Rate Limiting

### Sorted Sets (ZSET) — Sliding Window
```redis
ZADD ratelimit:192.168.1.1 1715001600000 req_abc123
ZREMRANGEBYSCORE ratelimit:192.168.1.1 0 1715001540000
ZCARD ratelimit:192.168.1.1
```

Perfect for sliding window log. Each request is a member with timestamp as score.

### Strings with TTL — Fixed Window
```redis
INCR ratelimit:192.168.1.1:14
EXPIRE ratelimit:192.168.1.1:14 3600
```

Simple, but vulnerable to boundary bursts.

### Lua Scripting — Atomic Conditional Logic
When you need to check, remove old entries, and add a new one — all atomically.

## 5. HTTP Headers

Clients deserve to know their budget:

| Header | Meaning |
|--------|---------|
| `X-RateLimit-Limit` | Maximum allowed requests |
| `X-RateLimit-Remaining` | Requests left in current window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds to wait (on 429 responses) |

RFC 6585 defines `429 Too Many Requests`. The IETF draft standardizes `RateLimit-*` headers.

## 6. Failure Modes

| Failure | Effect | Mitigation |
|---------|--------|------------|
| Redis down | All rate-limit checks fail | Fail open (allow traffic) + alert; or fail closed with local fallback |
| Clock skew | Wrong window calculations | Use Redis time (`TIME` command) as source of truth |
| Hot key | One `ratelimit:*` key hit millions of times | Shard by IP hash; use Redis Cluster |
| Identifier collision | Office of 5000 users shares one IP | Use authenticated user IDs instead of IPs |

## 7. The Fundamental Truth

> Rate limiting is not about perfect fairness. It is about **cost control** and **graceful degradation**. A 1% error in fairness is acceptable if the system prevents abuse without harming legitimate users. The goal is not to build a perfect gatekeeper; it is to build a gatekeeper that is good enough to keep the building standing.
