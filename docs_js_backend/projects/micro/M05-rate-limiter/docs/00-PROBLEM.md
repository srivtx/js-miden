# 00-PROBLEM.md — Rate Limiter (M05)

## WHAT

Build an HTTP middleware that caps the number of requests a single client can make to a protected endpoint within a sliding time window. The system must:

1. Allow at most **10 requests per minute per IP** to `GET /api/data`.
2. Return **HTTP 429 Too Many Requests** when the limit is exceeded.
3. Include a `Retry-After` header telling the client how many seconds to wait.
4. Be accurate: a burst of 20 requests in one second must **not** be possible.
5. Work across multiple server instances (distributed state).

## WHY

Without rate limiting, a single malicious client—or a misbehaving script—can:

- Exhaust downstream database connections.
- Trigger expensive operations (e.g., report generation) repeatedly.
- Drown out legitimate traffic, causing a de-facto Denial of Service (DoS).
- Rack up cloud costs (e.g., Lambda invocations, egress bandwidth).

Rate limiting is one of the **cheapest** defenses you can deploy. It belongs in every public-facing API.

## CONSTRAINTS

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Window size | 60 seconds | Industry default for user-facing APIs |
| Max requests | 10 / window | Low enough to stop abuse, high enough for normal use |
| Key scope | Per IP | Simplest viable identifier |
| State storage | Redis | Required for horizontal scaling |
| Protocol | HTTP with custom headers | `X-RateLimit-*` + `Retry-After` |
| Failure mode | **Fail open** | If Redis is down, allow traffic (availability > strictness for this tier) |

## SCOPE

### In Scope
- Express middleware that intercepts requests before route handlers.
- Redis-based counter with TTL expiration.
- Rate-limit headers on every response (200 and 429).
- Boundary burst test (`boundary-test.js`) to validate correctness.

### Out of Scope
- Per-user or per-API-key quotas (would require auth layer).
- Dynamic limits based on subscription tier.
- WebSocket rate limiting.
- DDoS mitigation at the network edge (Cloudflare, AWS WAF).
- CAPTCHA or challenge-response on block.

## ACCEPTANCE CRITERIA

1. Sending 10 requests in 10 seconds → all return `200`.
2. Sending the 11th request in the same minute → returns `429` with `Retry-After`.
3. Waiting 60 seconds → counter resets, request succeeds again.
4. Sending 10 requests at `01:59:59` and 10 at `02:00:00` → **second batch is blocked** (true sliding window).
5. Unit tests cover happy path, edge case, and header assertions.

## SOURCES

- [RFC 6585 — HTTP Status Code 429](https://datatracker.ietf.org/doc/html/rfc6585)
- [IETF Draft — RateLimit Header Fields for HTTP](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)
- Cloudflare, "How to Build a Rate Limiter," 2023.
