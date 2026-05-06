# 02-DECISIONS.md — Rate Limiter (M05)

## 1. Fixed Window vs Sliding Window vs Token Bucket

### WHAT

Three algorithms for enforcing rate limits:

| Algorithm | Core Idea | Burst Tolerance | Implementation Complexity |
|-----------|-----------|-----------------|---------------------------|
| **Fixed Window** | Count requests in discrete time buckets (e.g., minute 0-59, 60-119). | High (2x at boundary) | Very low |
| **Sliding Window** | Count requests in a rolling interval (last 60 seconds). | Low (accurate) | Medium |
| **Token Bucket** | Tokens refill at fixed rate; each request consumes one token. | Configurable | Medium |

### WHY

- **Fixed window** is simple but allows a burst of 2x the limit at window boundaries. For 10/min, an attacker gets 20 in ~1 second.
- **Sliding window** is accurate but requires storing timestamps or maintaining a counter with fractional decay.
- **Token bucket** allows controlled bursts (e.g., 10 instant, then 1 every 6 seconds) which is great for APIs but harder to explain.

### DECISION

The project **claims** to use a sliding window log (storing per-request timestamps in Redis sorted sets) but **actually ships** with a fixed-window counter (`INCR` + `EXPIRE`). This intentional mismatch demonstrates the boundary burst bug. See `06-BUGS.md`.

**For production:** Use sliding window log for accuracy, or token bucket if controlled bursts are a feature.

## 2. Memory vs Redis Storage

### WHAT

| Storage | Scope | Persistence | Latency | Complexity |
|---------|-------|-------------|---------|------------|
| In-memory (`Map`) | Single process | Lost on restart / crash | ~nanoseconds | None |
| Redis | Distributed, multi-process | Configurable (AOF/RDB) | ~1-5 ms | Requires infra |

### WHY

In-memory storage is fine for a single server but breaks immediately when:
- You scale to 2+ instances (load balancer round-robins).
- You deploy rolling updates (state lost during restart).
- You use serverless (container lives for one request).

Redis provides a single source of truth for all app instances.

### DECISION

Use **Redis** with `ioredis`. The `INCR` + `PEXPIRE` pattern is atomic and TTL-native. For the true sliding window fix, Redis sorted sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`) are the perfect data structure.

## 3. IP vs User Identification

### WHAT

| Identifier | Pros | Cons |
|------------|------|------|
| **IP Address** | Stateless, works without auth | Shared NAT, easy to change (VPN, proxy), IPv6 privacy extensions |
| **User ID** | Accurate per-account | Requires authentication layer |
| **API Key** | Granular, revocable | Key management overhead |
| **Session Cookie** | Stateful, accurate | Vulnerable to session hijacking |

### WHY

IP is the lowest common denominator. It requires no login, no API key registry, no session store. However, it is the least accurate identifier.

### DECISION

Use **IP address** (`req.ip`) for this micro project. In production, tier the strategy:
1. If authenticated → use `userId`.
2. If API key → use `apiKey`.
3. Otherwise → fallback to IP with a higher, more lenient limit.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Use `req.socket.remoteAddress` behind a load balancer (gets the load balancer's IP) | Trust `req.ip` (Express normalizes `X-Forwarded-For` when `trust proxy` is set) |
| Block an entire /24 subnet because one user abused it | Rate-limit per individual identifier; subnet blocking is a separate WAF concern |
| No fallback if identifier is missing | Default to a generous limit or block entirely with a clear error |

## SOURCES

- Cloudflare Blog, "How We Built Rate Limiting," 2022.
- Stripe Engineering, "Rate Limiters," 2017.
- Redis docs, "Sorted Sets" and "Transactions."
