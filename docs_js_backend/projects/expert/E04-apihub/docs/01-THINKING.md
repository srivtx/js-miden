# E04 API Hub: Design Thinking

## Constraints & Forces

### 1. Latency vs Security
Every security check (auth, rate limit, consent) adds latency. A request that touches 5 services might take 200ms. But skipping checks creates vulnerabilities.

**Resolution**: Cache auth tokens and rate limit counters in Redis (sub-millisecond). Do heavy validation async (usage tracking, analytics).

### 2. Accuracy vs Performance
Exact usage counting requires database transactions. High-performance counting uses approximate counters (HyperLogLog, Count-Min Sketch).

**Resolution**: Use atomic database increments for billing-critical counts. Use approximate counters for real-time analytics dashboards.

### 3. Flexibility vs Consistency
Every API provider wants custom auth, custom rate limits, custom billing rules. But every custom rule is a potential bug.

**Resolution**: Standardize on a few tier templates (free, pro, enterprise). Allow custom rules only for enterprise customers with dedicated support.

## Mental Models

### The Gateway as a Firewall
The gateway is the only public-facing service. All other services are internal. The gateway:
1. Terminates TLS
2. Validates API keys
3. Checks rate limits
4. Routes to the correct backend
5. Records usage (async)
6. Returns response to client

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Gateway   │─────▶│  Auth Service│      │  Backend API │
│  (Public)   │◀─────│  (Internal)  │      │  (Internal)  │
└──────┬──────┘      └──────────────┘      └──────────────┘
       │
       │ Async
       ▼
┌─────────────┐      ┌──────────────┐
│   Usage     │─────▶│   Billing    │
│   Service   │      │   Service    │
└─────────────┘      └──────────────┘
```

### API Key as a Capability
An API key is not just a password. It is a capability token that encodes:
- Who (developer ID)
- What (API ID, endpoint permissions)
- How much (tier, rate limit)
- When (expiration date)

### Usage Aggregation as Double-Entry Bookkeeping
Every API call creates two records:
1. A raw usage record (immutable, for audit)
2. An aggregated counter (mutable, for billing)

The aggregate must always equal the sum of raw records. Any discrepancy is a bug.

## Risk Scenarios

1. **Cross-tenant access**: Developer A's key accesses Developer B's API. Data breach, regulatory fine, lawsuit.
2. **Rate limit bypass**: A client sends `x-tier-override: premium` and the gateway respects it. Free users get unlimited access.
3. **Lost usage counts**: 20 concurrent requests read `totalRequests: 5`, all increment to 6. The aggregate ends up at 6 instead of 25. Revenue is lost.
4. **Billing mismatch**: Usage says 10,000 requests. Billing calculates $50. But the invoice says $0 because of a rounding bug.

## Trade-Off Analysis

| Approach | Pros | Cons |
|----------|------|------|
| Synchronous usage tracking | Exact counts, simple | Adds 10-50ms latency per request |
| Async usage tracking (queue) | Zero latency impact | May lose messages under load |
| Redis counters | Sub-millisecond, atomic | Data loss on Redis failure |
| Database transactions | ACID, durable | Slow, connection pool exhaustion |
| API keys in headers | Simple, standard | Keys leak in logs if not careful |
| OAuth2 / JWT | Rotatable, scoped | Complex, token size issues |
| Per-request billing | Exact, fair | High database load |
| Monthly aggregation | Efficient | Disputes harder to resolve |
