# 04-OLD-VS-NEW.md — Rate Limiter (M05)

## Old Patterns (Pre-2015)

### 1. In-Memory Counters in Apache/Nginx Modules

**WHAT:** `mod_evasive` (Apache) or `limit_req` (Nginx) tracked requests in process-local memory.

**WHY it was common:** Single-server deployments were the norm.

**WRONG today:** Cloud-native apps run 10-1000 instances. In-memory state is lost on every deployment and is invisible to other pods.

---

### 2. Database Row Locking

**WHAT:** `UPDATE rate_limits SET count = count + 1 WHERE user_id = ?` with `FOR UPDATE`.

**WHY it was used:** Developers already had a SQL database; no need for Redis.

**WRONG today:** Row-level locking is slow (tens of milliseconds), serializes all requests for a user, and becomes a bottleneck at scale. Also, TTL is not native—you need a cron job to clean old rows.

---

### 3. Custom HTTP 503 for Throttling

**WHAT:** Returning `503 Service Unavailable` when a user hit a limit.

**WHY it was wrong:** 503 implies the **server** is overloaded, not the **client**. It triggers load balancer health-check removals and CDN cache poisoning.

**RIGHT today:** Always use `429 Too Many Requests` for client-side rate limiting.

---

## Modern Patterns (2020+)

### 1. Redis + Lua Atomics

**WHAT:** Single round-trip Lua scripts that read, check, and write atomically.

**WHY it is right:** Eliminates race conditions without transactions. Redis 7+ supports Redis Functions (persistent Lua) for better ops management.

---

### 2. Dedicated Edge Rate Limiters

**WHAT:** Cloudflare, AWS WAF, and Envoy proxy enforce limits at the edge, before traffic reaches the app server.

**WHY it is right:** Blocks abuse closer to the attacker, saves origin server CPU, and scales infinitely.

**Trade-off:** Less granular (usually IP-based, not user-based).

---

### 3. Token Bucket in API Gateways

**WHAT:** Kong, AWS API Gateway, and Zuul implement token bucket algorithms with configurable burst capacity.

**WHY it is right:** Token bucket is the industry standard for public APIs (Stripe, GitHub, Twitter) because it allows controlled bursts.

---

### 4. Standardized RateLimit Headers

**WHAT:** The IETF `RateLimit` header draft (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).

**WHY it is right:** Replaces the non-standard `X-RateLimit-*` prefix. Standard headers allow SDKs and clients to handle throttling automatically.

---

## Comparison Table

| Era | Storage | Algorithm | Headers | Failure Mode |
|-----|---------|-----------|---------|--------------|
| 2010 | In-memory / DB | Fixed window | None | Fail closed |
| 2015 | Redis | Fixed / Sliding | `X-RateLimit-*` | Mixed |
| 2024 | Redis / Edge | Token bucket / Sliding | `RateLimit-*` (IETF) | Fail open + alert |

## WRONG vs RIGHT

| WRONG (Old) | RIGHT (Modern) |
|-------------|----------------|
| Single-server memory | Distributed Redis or edge proxy |
| Database row locks | Redis atomic ops or Lua |
| `503` for throttling | `429` for client limits, `503` only for server overload |
| Custom header names | IETF `RateLimit-*` headers |
| Fail closed, crash on DB error | Fail open with circuit breaker and monitoring |

## SOURCES

- Cloudflare Blog, "How We Scaled Rate Limiting," 2022.
- Stripe API Docs, "Rate Limits."
- IETF Draft, "RateLimit Header Fields for HTTP," 2024.
