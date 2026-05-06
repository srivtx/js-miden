# 02 - Gateway Service

## WHAT

The Gateway Service is the single entry point for all API marketplace traffic. It acts as a reverse proxy, authentication gatekeeper, rate limiter, and usage event generator.

**Responsibilities:**
- Route incoming requests to registered target APIs
- Validate API keys via the Auth service
- Enforce per-second rate limits based on subscription tier
- Record usage events for billing and analytics
- Return rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)

## WHY

### Why a Gateway Pattern?

Without a gateway, every target API would need to implement:
- Key validation logic
- Rate limiting
- Usage tracking
- Billing integration

This creates N times the work for N APIs and makes it impossible to change auth mechanisms without updating every API.

The Gateway centralizes cross-cutting concerns:
- **Authentication:** One place to validate keys
- **Rate Limiting:** One algorithm to tune
- **Observability:** One point to collect metrics
- **Billing:** One integration point for usage tracking

### Why Per-Second Rate Limits?

Per-second limits protect target APIs from burst traffic. A monthly quota of 1M requests means nothing if a consumer sends all 1M in the first minute.

## HOW

### Proxy Flow

```typescript
// 1. Extract API key from header
const apiKey = req.headers['x-api-key'];

// 2. Validate with Auth service
const authResult = await authClient.post('/keys/validate', { key: apiKey });

// 3. Check rate limit (in-memory for demo, Redis in production)
const rateLimit = await checkRateLimit(authResult.apiKeyId, tier.rateLimitPerSecond);

// 4. Look up target API
const targetApi = targetApis.get(req.params.apiId);

// 5. Proxy request (simulated)
const response = await proxyToTarget(targetApi.baseUrl, req);

// 6. Record usage
await usageClient.post('/track', {
  apiKeyId: authResult.apiKeyId,
  apiId: targetApi.id,
  endpoint: req.path,
  method: req.method,
  statusCode: response.status,
  responseTimeMs: Date.now() - startTime
});

// 7. Return response with rate limit headers
res.set('X-RateLimit-Remaining', rateLimit.remaining);
```

### Rate Limit Algorithm

The service uses a fixed window counter:
- Key format: `{apiKeyId}:{Math.floor(now / 1000)}`
- Window size: 1 second
- Limit: tier-specific (e.g., 10 req/s for free, 1000 req/s for enterprise)

In production, use a sliding window log or token bucket for smoother limiting.

## WRONG vs RIGHT

### WRONG: Validating Key but Not API Ownership

```typescript
// WRONG: The bug in our current implementation
const authResult = await authClient.validate(key); // "This key is valid"
const targetApi = targetApis.get(apiId); // "This API exists"
// MISSING: Check if authResult.developerId === targetApi.developerId
await proxyRequest(targetApi, req); // BUG: Any valid key accesses any API!
```

**Why Wrong:** Developer A creates a key for their test API. Developer B registers a premium API. Developer A's key can access Developer B's API, bypassing subscriptions entirely.

**Impact:** Revenue loss, data leakage between developers, complete breakdown of the subscription model.

### RIGHT: Ownership Verification

```typescript
// RIGHT: Verify the key is authorized for THIS specific API
const authResult = await authClient.validate(key);
const targetApi = targetApis.get(apiId);

if (!targetApi) {
  return res.status(404).json({ error: 'API not found' });
}

// CRITICAL: Verify the API key belongs to the consumer who subscribed to this API
const subscription = await portalClient.get(
  `/subscriptions/check?consumerId=${authResult.developerId}&apiId=${apiId}`
);

if (!subscription.active) {
  return res.status(403).json({ error: 'Not subscribed to this API' });
}

// Also verify the key was issued FOR this API
if (authResult.apiId !== apiId) {
  return res.status(403).json({ error: 'Key not authorized for this API' });
}

await proxyRequest(targetApi, req);
```

**Why Right:** Every request is checked against the subscription registry. Keys are scoped to specific APIs. Cross-developer access is impossible.

### WRONG: Blocking on Non-Critical Services

```typescript
// WRONG: Waiting for analytics before responding
await usageClient.track(request);
await analyticsClient.record(request); // Don't block here!
await billingClient.checkQuota(request); // Don't block here!
const response = await proxyRequest(target, req);
res.json(response);
```

**Why Wrong:** Analytics service latency directly impacts API response time. If Analytics is down, the gateway fails requests.

### RIGHT: Async Side Effects with Retry

```typescript
// RIGHT: Track usage synchronously (critical for billing)
await usageClient.track(request);

// Fire analytics asynchronously with local retry
analyticsClient.record(request)
  .catch(err => deadLetterQueue.push({ service: 'analytics', payload: request, error: err }));

// Proxy and respond immediately
const response = await proxyRequest(target, req);
res.json(response);
```

**Why Right:** The critical path is: validate -> rate limit -> proxy. Everything else can happen asynchronously. Use a message queue (Redis Streams, RabbitMQ, SQS) for guaranteed delivery.

### WRONG: In-Memory Rate Limiting

```typescript
// WRONG: Rate limit state in process memory
const rateLimitStore = new Map(); // Lost on restart, not shared across instances
```

**Why Wrong:** In a multi-instance gateway deployment, each instance has its own counter. A consumer could send 10 req/s to instance A AND 10 req/s to instance B, effectively doubling their limit.

### RIGHT: Distributed Rate Limiting with Redis

```typescript
// RIGHT: Centralized counter with atomic operations
const allowed = await redis.eval(`
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, 1)
  end
  return current <= limit
`, 1, `rate:${apiKeyId}:${Math.floor(Date.now()/1000)}`, tierLimit);
```

**Why Right:** All gateway instances share the same counter. The Lua script is atomic. No race conditions.
