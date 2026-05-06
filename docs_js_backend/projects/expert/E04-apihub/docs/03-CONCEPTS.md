# E04 API Hub: Core Concepts

## WHAT: API Marketplace Platform

An API Hub is a multi-tenant platform that allows API providers to publish APIs and API consumers to discover, subscribe to, and use them—with built-in authentication, rate limiting, usage tracking, and billing.

```
┌─────────────────────────────────────────────────────────────┐
│                    API MARKETPLACE ARCHITECTURE              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Developer  │  │   Gateway   │  │   Backend   │         │
│  │   Portal    │  │   Service   │  │    APIs     │         │
│  │             │  │             │  │             │         │
│  │ - Register  │  │ - Validate  │  │ - Weather   │         │
│  │ - Document  │  │   API key   │  │ - Payments  │         │
│  │ - Tier mgmt │  │ - Rate limit│  │ - ML        │         │
│  └─────────────┘  │ - Proxy     │  └─────────────┘         │
│                   └──────┬──────┘                          │
│                          │                                  │
│                   ┌──────┴──────┐                          │
│                   │  Auth Svcs  │                          │
│                   │  Usage Svc  │                          │
│                   │  Billing Svc│                          │
│                   └─────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## WHY: Why These Protections?

### Why Multi-Tenant Isolation?
Because a platform hosting 1,000 developers cannot allow Developer #42 to access Developer #7's customer data. This is not just a bug—it's a data breach that triggers GDPR Article 33 notification requirements and potential fines of 4% of global revenue.

### Why Atomic Usage Tracking?
Because billing disputes are expensive. If a user makes 1M requests and you bill them for 800K because of race conditions, they will dispute. If you bill them for 1.2M because of double-counting, they will sue. Exact counts are a legal requirement.

### Why Rate Limiting?
Because APIs are resources. An unthrottled API can be DDoS'd accidentally (viral app) or maliciously (botnet). Rate limits protect backend services and enforce pricing tiers.

## HOW: Correct Implementation

### Cross-Developer Authorization
```typescript
router.all('/:apiId/*', validateApiKey, async (req, res) => {
  const apiKeyContext = (req as any).apiKeyContext;
  const targetApi = targetApis.get(req.params.apiId);
  
  if (!targetApi) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  // CRITICAL: Verify the API key belongs to an authorized consumer
  // Option A: The key's developer IS the API owner (self-use)
  // Option B: The key's developer has an active subscription to this API
  const isOwner = apiKeyContext.developerId === targetApi.developerId;
  const hasSubscription = await checkSubscription(apiKeyContext.apiKeyId, req.params.apiId);
  
  if (!isOwner && !hasSubscription) {
    return res.status(403).json({ 
      error: 'Not authorized', 
      detail: 'Your API key does not have access to this API' 
    });
  }
  
  // ... rest of proxy logic
});
```

### Atomic Usage Tracking
```typescript
// CORRECT: Database-level atomic increment
await db.query(
  `INSERT INTO usage_aggregates (api_key_id, api_id, year, month, total_requests, total_response_time_ms, error_count)
   VALUES ($1, $2, $3, $4, 1, $5, $6)
   ON CONFLICT (api_key_id, api_id, year, month)
   DO UPDATE SET
     total_requests = usage_aggregates.total_requests + 1,
     total_response_time_ms = usage_aggregates.total_response_time_ms + $5,
     error_count = usage_aggregates.error_count + $6`,
  [apiKeyId, apiId, year, month, responseTimeMs, statusCode >= 400 ? 1 : 0]
);

// Alternative: Redis atomic increment
await redis.incr(`usage:${apiKeyId}:${apiId}:${year}-${month}`);
```

### Tier Enforcement
```typescript
// CORRECT: Ignore client headers for tier determination
const tier = await getTierByApiKey(apiKeyContext.apiKeyId);
const limit = tier.requestsPerMonth;

// WRONG: Never trust client-provided tier
// const limit = req.headers['x-tier-override'] || tier.requestsPerMonth;
```

## WRONG vs RIGHT

### WRONG: No Cross-Developer Check
```typescript
// BUG: Any valid API key can access any API
const targetApi = targetApis.get(apiId);
// No check: apiKeyContext.developerId === targetApi.developerId ???

// Proxy the request
res.json({ proxied: true, apiId });
```

**Why it's wrong**: Developer A creates a key for their own API. Developer B discovers Developer C's private API. Developer B uses their own key to access Developer C's API. The gateway allows it because it never checks ownership or subscription.

### RIGHT: Enforce Authorization
```typescript
// CORRECT: Verify subscription or ownership
const authorized = await isAuthorized(apiKeyContext.apiKeyId, apiId);
if (!authorized) {
  return res.status(403).json({ error: 'API key not authorized for this API' });
}
```

### WRONG: Non-Atomic Read-Modify-Write
```typescript
// BUG: Lost updates under concurrency
const aggregate = aggregates.get(key);
aggregate.totalRequests += 1; // Race condition!
```

**Why it's wrong**: 20 concurrent requests all read `totalRequests: 5`. All increment to 6. All write back 6. The true count should be 25, but the aggregate shows 6.

### RIGHT: Atomic Increment
```typescript
// CORRECT: Database guarantees atomicity
await db.query(
  `UPDATE usage_aggregates SET total_requests = total_requests + 1 WHERE key = $1`,
  [key]
);
```

### WRONG: Tier Override via Header
```typescript
// BUG: Client can escalate their tier
const limit = req.headers['x-tier-override'] || tier.requestsPerMonth;
```

**Why it's wrong**: A free-tier user sends `x-tier-override: enterprise` and gets unlimited requests.

### RIGHT: Server-Determined Tier
```typescript
// CORRECT: Tier is determined server-side from the database
const tier = await db.getTier(apiKeyContext.tierId);
const limit = tier.requestsPerMonth; // Client cannot influence this
```
