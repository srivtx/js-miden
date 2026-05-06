# E04 API Hub: Architecture Decisions

## Decision 1: Microservices Architecture

**Chosen**: Separate services for gateway, auth, usage, billing, analytics, and developer portal.

**Alternatives Considered**:
- **Monolith**: All code in one deployable unit. Pro: simple, fast to develop. Con: hard to scale independently, one bug takes down everything.
- **Serverless (Lambda/Cloud Functions)**: Each endpoint is a function. Pro: auto-scales, pay-per-request. Con: cold starts, complex inter-service communication.
- **Service mesh (Istio/Linkerd)**: Sidecar proxies handle all networking. Pro: observability, security. Con: operational complexity, latency overhead.

**Rationale**: Microservices allow independent scaling (gateway needs more CPU, billing needs more disk) and independent deployment (fix auth without redeploying usage).

## Decision 2: API Keys in Headers

**Chosen**: `x-api-key` header for authentication.

**Alternatives Considered**:
- **OAuth2 Bearer tokens**: Standard for user-facing APIs. Pro: scoped, refreshable. Con: complex for machine-to-machine, token size.
- **mTLS**: Mutual TLS with client certificates. Pro: very strong. Con: certificate management hell.
- **Signed requests (AWS Signature v4)**: Cryptographically signed requests. Pro: no key transmission. Con: complex client implementation.
- **IP allowlisting**: Only accept requests from known IPs. Pro: simple. Con: doesn't work for mobile/cloud clients.

**Rationale**: API keys are the industry standard for developer-facing APIs. They are simple, stateless, and easy to rotate.

## Decision 3: In-Memory Rate Limiting

**Chosen**: JavaScript Map with per-second windows.

**Alternatives Considered**:
- **Redis sliding window**: More accurate, distributed. Con: 1-5ms latency, Redis dependency.
- **Token bucket (Redis)**: Smooths bursts. Con: more complex, still requires Redis.
- **Fixed window (in-memory)**: Simple, fast. Con: allows burst at window boundary (thundering herd).
- **Leaky bucket**: Smooths rate precisely. Con: harder to implement, doesn't allow bursts.

**Rationale**: For a demo, in-memory is fine. For production, Redis token bucket is the standard.

## Decision 4: No Cross-Developer Authorization Check

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: The gateway must verify that the API key's `developerId` matches the target API's `developerId`, OR that the target API explicitly allows cross-developer access.

**Why the original skipped it**: The proxy route fetches the target API but never checks if the requesting developer owns it or has permission.

## Decision 5: Non-Atomic Usage Aggregation

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: Use `UPDATE usage_aggregate SET total_requests = total_requests + 1 WHERE ...` or Redis `INCR` for atomic increments.

**Why the original skipped it**: Read-modify-write is the intuitive way to increment. Under concurrency, it is wrong.
