# 01-THINKING.md — Rate Limiter (M05)

## Mental Model: The Bouncer at the Door

Imagine a nightclub with a bouncer who keeps a tally of how many people entered in the last 60 minutes. If someone tries to enter and the tally is already at 10, they are turned away and told: "Come back in X minutes."

The bouncer must:
- Remember who you are (identity).
- Forget entries older than 60 minutes (window expiry).
- Work even if there are multiple doors (distributed servers).
- Not lock the doors if his notebook is stolen (fail open).

## The Hot Path

Every request to `/api/data` triggers this sequence:

```
1. Extract client IP from req.ip
2. Compute current window boundary (Math.floor(now / 60000) * 60000)
3. INCR Redis key "ratelimit:<ip>:<window>"
4. IF first request → PEXPIRE key 60000
5. Read TTL of key
6. Set rate-limit headers
7. IF count > 10 → 429 + Retry-After
8. ELSE → call next()
```

**The hot path touches Redis on every request.** Latency here is critical. A single `INCR` + `PTTL` round-trip is ~1-2 ms on localhost, ~5-10 ms in the same datacenter. Any additional round-trips (e.g., separate `GET` then `SET`) multiply latency.

## Danger Zones

### 1. Clock Skew
If the app server and Redis server have different system clocks, `PTTL` may return confusing values. **Mitigation:** Use Redis TTL as the source of truth; do not compute expiry client-side.

### 2. Race Condition on First Request
Two simultaneous requests from the same new IP could both see `current === 1` and both try to set `PEXPIRE`. Redis `INCR` is atomic, but the subsequent conditional `PEXPIRE` is not. **Mitigation:** Use a Lua script or Redis transaction (`MULTI` / `EXEC`).

### 3. IP Spoofing / Shared NAT
- `X-Forwarded-For` can be spoofed if not sanitized.
- Office buildings, mobile carriers, and universities share a single public IP among thousands of users.
- **Mitigation:** Production systems should use authenticated user IDs or API keys, not raw IPs.

### 4. Redis as Single Point of Failure
If Redis goes down, every request fails the rate-limit check. **Mitigation:** Fail open (allow traffic) and alert. Alternatively, use a local in-memory fallback with circuit breaker logic.

### 5. The Boundary Burst (Intentional Bug)
Fixed-window counters reset at exact minute boundaries. An attacker can send 10 requests at `01:59:59` and 10 at `02:00:00`, achieving 20 requests in 1 second. See `06-BUGS.md` for the full timeline.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Store counters in a plain JavaScript `Map` (single-server only) | Use Redis for distributed, persistent state |
| Read counter, increment, write back (non-atomic) | Use `INCR` or Lua scripts for atomic operations |
| Fail closed (block everyone if Redis is down) | Fail open with monitoring alerts |
| Trust `X-Forwarded-For` blindly | Normalize IPs, use auth-based identifiers in production |
| Fixed window without boundary tests | Sliding window or token bucket for accurate limiting |
| No headers on 200 responses | Always return `X-RateLimit-*` for client awareness |

## Key Insight

> Rate limiting is not about perfect fairness; it is about **cost control**. A 1% error in fairness is acceptable if the system prevents abuse without harming legitimate users.

## SOURCES

- Martin Kleppmann, *Designing Data-Intensive Applications*, Chapter 8 (Reliability).
- Redis docs, "INCR" and "EXPIRE" command reference.
