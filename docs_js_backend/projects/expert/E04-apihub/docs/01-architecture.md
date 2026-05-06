# 01 - System Architecture

## WHAT

ApiHub is a multi-service API marketplace platform. It consists of six independent services that communicate via HTTP APIs, backed by Redis for shared state and caching.

**Services:**
1. **Gateway Service (Port 3000)** - Single entry point for all API requests. Validates keys, enforces rate limits, proxies requests to target APIs, and records usage.
2. **Auth Service (Port 3001)** - Developer registration, authentication, API key generation, validation, rotation, and revocation.
3. **Usage Service (Port 3002)** - Real-time usage tracking, monthly aggregation, quota enforcement, and threshold alerts.
4. **Billing Service (Port 3003)** - Subscription tier management, invoice calculation, overage billing, and payment status tracking.
5. **Analytics Service (Port 3004)** - Metrics collection, dashboard data aggregation, endpoint performance analysis, and error rate tracking.
6. **Developer Portal Service (Port 3005)** - API registration, subscription management, webhook configuration, and developer dashboards.

## WHY

### Why Microservices?

**Scaling Independence:** The Gateway service handles the highest load and can be scaled independently of the Billing service, which runs batch jobs monthly.

**Team Autonomy:** Different teams can own different services. The Analytics team can deploy new metrics without touching the Auth service.

**Technology Flexibility:** While all services use Express/TypeScript in this implementation, the Analytics service could later be rewritten in a data-processing language without affecting others.

**Failure Isolation:** If the Billing service is down, API requests still flow through the Gateway. Consumers don't lose access because invoicing is delayed.

### Why Redis?

Redis serves as the shared state store because:
- **Rate limiting** requires sub-millisecond latency
- **Usage counters** need atomic increment operations (when implemented correctly)
- **Session/key caches** need TTL support for expiration
- **Pub/sub** enables cross-service event streaming for webhooks

## HOW

### Request Flow

```
Consumer Request
    |
    v
+-------------+
|   Gateway   |
+-------------+
    |
    +---> Auth Service (validate key)
    |
    +---> Rate Limit Check (Redis)
    |
    +---> Usage Service (track request)
    |
    +---> Analytics Service (record metric)
    |
    +---> Target API (proxy request)
    |
    v
Consumer Response
```

### Service Communication

All inter-service communication uses RESTful HTTP with JSON payloads. In production, this would be augmented with:
- **Circuit breakers** to prevent cascade failures
- **Retry policies** with exponential backoff
- **Request IDs** for distributed tracing
- **mTLS** for service-to-service authentication

### Data Flow

1. Developer registers via Portal -> Auth creates account
2. Developer registers API via Portal -> stored in Portal DB
3. Developer creates tiers via Billing -> stored in Billing DB
4. Consumer subscribes via Portal -> Auth generates key
5. Consumer sends request to Gateway -> Auth validates key
6. Gateway checks rate limit -> Redis
7. Gateway proxies request -> Target API
8. Gateway sends usage event -> Usage Service
9. Usage Service aggregates -> monthly counters
10. Billing reads aggregates -> generates invoices
11. Analytics reads events -> builds dashboards
12. Portal triggers webhooks -> developer endpoints

## WRONG vs RIGHT

### WRONG: Monolith with Direct DB Access

```
// WRONG: All code in one app, direct DB queries everywhere
app.post('/api/request', async (req, res) => {
  await db.query('UPDATE usage SET count = count + 1 WHERE key = ?', [req.key]);
  await db.query('INSERT INTO analytics VALUES (?)', [req.data]);
  await db.query('SELECT * FROM apis WHERE id = ?', [req.apiId]);
  // 500 lines of mixed concerns
});
```

**Why Wrong:** Tight coupling makes scaling impossible. A billing calculation bug brings down the entire API gateway.

### RIGHT: Service Boundaries with Clear APIs

```typescript
// Gateway only knows about its own concerns
const authResult = await authClient.post('/keys/validate', { key });
const rateLimit = await checkRateLimit(authResult.apiKeyId, tier.limit);
await usageClient.post('/track', { apiKeyId, apiId, ... });
// Each service handles its own data
```

**Why Right:** Gateway doesn't know how Billing calculates invoices. Usage doesn't know how Analytics aggregates metrics. Services can evolve independently.

### WRONG: Synchronous Cascading Calls

```typescript
// WRONG: Gateway waits for EVERY service before responding
await authClient.validate(key);
await usageClient.track(request);      // blocking
await analyticsClient.record(request); // blocking
await billingClient.checkQuota(request); // blocking
// finally proxy...
```

**Why Wrong:** If Analytics is slow, every API request is slow. The critical path should be minimal.

### RIGHT: Async for Non-Critical Path

```typescript
// RIGHT: Only block on critical operations
const authResult = await authClient.validate(key); // critical
const rateLimit = await checkRateLimit(key, limit); // critical

// Fire-and-forget for analytics (with retry queue)
analyticsClient.record(request).catch(err => retryQueue.push(err));
// Proxy immediately
const response = await proxyRequest(targetUrl, req);
```

**Why Right:** Consumer response time depends only on auth + rate limit + target API latency. Analytics lag is acceptable.
