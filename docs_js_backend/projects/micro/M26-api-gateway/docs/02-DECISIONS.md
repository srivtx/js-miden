# 02-DECISIONS: API Gateway

## WHAT decisions were made?

1. **Use Node.js `http.request` instead of a library like `http-proxy-middleware`**
2. **Attach `X-Request-ID` at the gateway layer**
3. **Use Express middleware pipeline for cross-cutting concerns**

## WHY these decisions?

### Decision 1: Raw `http.request`

**Pros:**
- Zero dependencies; full control over headers, timeouts, and error handling.
- Educational: forces understanding of Node.js streams and HTTP internals.

**Cons:**
- Easy to miss edge cases (the current bug).
- More code to maintain.

**Alternative:** `http-proxy-middleware`
- **Pros:** Battle-tested, handles WebSockets, supports path rewriting.
- **Cons:** Hides complexity; harder to customize timeout behavior.
- **Verdict:** Raw `http.request` is fine for a micro-project, but a production gateway should use a library or a dedicated proxy (Envoy, Nginx, Traefik).

### Decision 2: UUID Request IDs

**Pros:**
- Correlates logs across services.
- Standards-compliant (RFC 4122).

**Cons:**
- Adds 36 bytes per request.
- If the client already sent a trace ID, we should propagate it (OpenTelemetry).

**Alternative:** Snowflake IDs or ULID
- **Pros:** Sortable, shorter, faster to generate.
- **Cons:** Requires a library.
- **Verdict:** UUID v4 is acceptable for simplicity.

### Decision 3: Express Middleware Pipeline

**Pros:**
- Industry standard for Node.js.
- Easy to add auth, rate limiting, logging.

**Cons:**
- Single-threaded event loop can bottleneck CPU-intensive middleware.
- Express is slower than Fastify or raw Node.js.

**Alternative:** Fastify
- **Pros:** 2-3x faster, built-in JSON schema validation, better async/await support.
- **Cons:** Smaller ecosystem, different plugin model.
- **Verdict:** Express is fine for learning; Fastify for production throughput.

## WRONG vs RIGHT Decision-Making

| Decision | WRONG Approach | RIGHT Approach |
|----------|----------------|----------------|
| Proxy library | "I'll write it from scratch because I know HTTP." | "I'll use a battle-tested proxy and only customize what I need." |
| Timeouts | "We'll add them if we see issues." | "Timeouts are defined before the first deployment." |
| Tracing | "We don't need request IDs." | "Every request gets a traceable ID from edge to database." |

## Final Recommendation

For production, replace this custom gateway with **Envoy Proxy** or **Traefik**. They provide timeouts, retries, circuit breakers, and observability out of the box. This code is a learning vehicle, not a production system.
