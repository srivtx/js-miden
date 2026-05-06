# 08-CRITIQUE.md — Rate Limiter (M05)

## Senior Engineer Review

### Overall Assessment

This is a **solid teaching project** that intentionally embeds a real-world bug (fixed-window counter) to demonstrate the difference between naive and correct implementations. The architecture is appropriate for a micro project: Express + Redis, minimal dependencies, clear separation.

### Strengths

1. **Intentional Bug as Pedagogy**
   The fixed-window implementation with a boundary test is an excellent teaching tool. Too many tutorials pretend sliding windows are "easy" without showing why fixed windows fail.

2. **Fail-Open Behavior**
   ```typescript
   } catch (err) {
     console.error('Rate limiter Redis error:', err);
     next(); // Fail open
   }
   ```
   This is correct for a basic tier. Availability beats strictness when Redis is down. However, this should be paired with a **circuit breaker** and **alerting**.

3. **Header Compliance**
   Returning `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` shows awareness of client ergonomics.

4. **Docker Compose for Redis**
   Making the infrastructure reproducible in one command lowers the barrier to entry.

### Weaknesses

1. **IP-Based Identification is Fragile**
   ```typescript
   const ip = req.ip || req.socket.remoteAddress || 'unknown';
   ```
   In production, this breaks behind load balancers without `trust proxy` settings. Worse, NAT and VPNs mean multiple users share one IP. A production system should tier by `userId > apiKey > ip`.

2. **Fixed Window is Shipped, Not Fixed**
   The README says "Sliding Window Rate Limiter" but the code is fixed window. While intentional for teaching, this is dangerous if a junior copies the code without reading the README.

   **Recommendation:** Add a giant comment block in `rate-limiter.ts`:
   ```typescript
   // WARNING: This implementation intentionally uses a fixed window
   // to demonstrate the boundary burst bug. Do NOT copy into production.
   // See docs/06-BUGS.md for the true sliding window fix.
   ```

3. **No Circuit Breaker**
   If Redis is slow (not down), every request waits for the timeout. A circuit breaker (e.g., `opossum` npm package) would short-circuit after N failures.

4. **Rate Limit Headers on Error Responses**
   The code sets headers even when Redis throws and we fail open. This is misleading—a client might see `X-RateLimit-Remaining: 10` when no limiting is actually happening.

5. **Key Collision Risk**
   ```typescript
   const key = `ratelimit:${ip}:${windowStart}`;
   ```
   IPv6 addresses contain colons. Redis keys use colons as convention. This is fine but should be normalized (e.g., replace `:` with `-`).

### Code Smells

| Smell | Location | Severity |
|-------|----------|----------|
| Magic numbers (`60 * 1000`, `10`) | `rate-limiter.ts` | Low — acceptable for micro project |
| `String(Math.max(0, ...))` coercion | Header setting | Low — explicit is fine |
| No `req.ip` normalization | Extraction | Medium — `unknown` fallback is a footgun |

### What Would Make This Production-Grade

1. **Lua-scripted sliding window** (see `03-CONCEPTS.md`).
2. **Per-user tiered limits** stored in a config database.
3. **Redis Sentinel or Cluster** for HA.
4. **Metrics:** Emit Prometheus counters for `rate_limit_hits`, `rate_limit_misses`, `redis_errors`.
5. **Structured logging** (Pino/Winston) instead of `console.error`.
6. **Integration tests** with simulated clock skew.

### Final Verdict

> **B+ as a teaching project. D as production code.**
>
> Use it to learn why sliding windows matter. Do not copy-paste it into a real API without the fixes outlined above.

## WRONG vs RIGHT

| Wrong (Current) | Right (Production) |
|-----------------|--------------------|
| IP-only identification | Tiered: user > API key > IP |
| Fixed window with misleading README | True sliding window or token bucket |
| `console.error` on Redis failure | Structured logs + circuit breaker + alerts |
| No metrics | Prometheus / Datadog integration |
| Single Redis instance | Redis Sentinel or Cluster |

## SOURCES

- Author's own review based on 10+ years of building high-traffic APIs.
- Stripe Engineering Blog, "Rate Limiters," 2017.
- Google SRE Book, "Handling Overload," Chapter 22.
