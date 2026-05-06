# 08 - Security Bugs Analysis

## WHAT

This document analyzes three critical security vulnerabilities intentionally present in the ApiHub codebase. Each bug is demonstrated with a failing test, root cause analysis, and the correct implementation.

## BUG-001: Cross-Developer API Key Access

### WHAT

A valid API key from Developer A can be used to access APIs registered by Developer B, bypassing the subscription model entirely.

### WHY IT EXISTS

The Gateway validates that the API key is active and not expired, but never checks whether the key's owner is authorized to access the specific API being requested.

### HOW IT WORKS

```typescript
// In gateway/src/routes/proxy.ts
router.all('/:apiId/*', validateApiKey, async (req, res) => {
  const apiKeyContext = (req as any).apiKeyContext;
  const apiId = req.params.apiId;
  
  const targetApi = targetApis.get(apiId);
  if (!targetApi) {
    return res.status(404).json({ error: 'API not found' });
  }
  
  // MISSING: Verify apiKeyContext.developerId is subscribed to this API
  // The key is valid, so we proxy the request...
  await proxyRequest(targetApi, req);
});
```

**Attack Scenario:**
1. Developer A registers and gets a free API key for their test API
2. Developer B registers a premium API with valuable data
3. Developer A sends requests to Developer B's API using their own key
4. Gateway validates the key (it's valid!) and proxies the request
5. Developer A accesses Developer B's premium API without paying

### WRONG vs RIGHT

**WRONG:**
```typescript
// Gateway only validates the key exists
const authResult = await authClient.post('/keys/validate', { key: apiKey });
if (!authResult.valid) {
  return res.status(401).json({ error: 'Invalid key' });
}
// No check: "Does this key belong to someone subscribed to THIS API?"
```

**RIGHT:**
```typescript
// Gateway validates key AND authorization
const authResult = await authClient.post('/keys/validate', { key: apiKey });
if (!authResult.valid) {
  return res.status(401).json({ error: 'Invalid key' });
}

// Verify the key is authorized for THIS specific API
if (authResult.apiId !== apiId) {
  return res.status(403).json({ 
    error: 'Key not authorized for this API',
    keyApiId: authResult.apiId,
    requestedApiId: apiId
  });
}

// Verify the developer has an active subscription
const subscription = await portalClient.get(
  `/subscriptions/check?consumerId=${authResult.developerId}&apiId=${apiId}`
);
if (!subscription.active) {
  return res.status(403).json({ error: 'Subscription expired or cancelled' });
}

await proxyRequest(targetApi, req);
```

**Why Right:** The key is validated in two dimensions: existence (Auth) AND authorization (Portal). A key must be explicitly scoped to an API, and the subscription must be active.

---

## BUG-002: Non-Atomic Usage Aggregation (Double-Counting / Lost Updates)

### WHAT

Under concurrent request load, usage counters fail to increment correctly. Some requests are "lost" and not counted toward quotas or billing.

### WHY IT EXISTS

The Usage Service uses a read-modify-write pattern on a shared Map without any locking or atomic operations.

### HOW IT WORKS

```typescript
// In usage/src/routes/tracking.ts
let aggregate = aggregates.get(aggregateKey);
if (!aggregate) {
  aggregate = createNewAggregate();
  aggregates.set(aggregateKey, aggregate);
}

// THREE SEPARATE, NON-ATOMIC OPERATIONS:
// 1. Read aggregate from Map
// 2. Increment in JavaScript memory
// 3. Write back to Map (but it's the same object reference!)
aggregate.totalRequests += 1;
```

**Race Condition:**
- Thread A reads `totalRequests = 5`
- Thread B reads `totalRequests = 5` (before A writes)
- Thread A increments to 6
- Thread B increments to 6
- Final value: 6 (should be 7!)

With 10 concurrent requests, the final count might be 6, 7, 8, or 9 instead of the correct 10.

### WRONG vs RIGHT

**WRONG:**
```typescript
// Read-modify-write without atomicity
let aggregate = aggregates.get(key);
if (!aggregate) {
  aggregate = { totalRequests: 0, ... };
  aggregates.set(key, aggregate);
}
aggregate.totalRequests += 1; // Race condition!
```

**RIGHT (with Redis):**
```typescript
// Atomic increment using Redis
const aggregateKey = `usage:${apiKeyId}:${apiId}:${year}-${month}`;

// HINCRBY is atomic - no race conditions possible
const newCount = await redis.hincrby(aggregateKey, 'totalRequests', 1);
await redis.hincrby(aggregateKey, 'totalResponseTimeMs', responseTimeMs);

if (statusCode >= 400) {
  await redis.hincrby(aggregateKey, 'errorCount', 1);
}
```

**RIGHT (with database):**
```typescript
// Atomic UPSERT with increment
await db.query(`
  INSERT INTO usage_aggregates 
    (api_key_id, api_id, year, month, total_requests, total_response_time_ms, error_count)
  VALUES (?, ?, ?, ?, 1, ?, ?)
  ON CONFLICT (api_key_id, api_id, year, month) 
  DO UPDATE SET
    total_requests = usage_aggregates.total_requests + 1,
    total_response_time_ms = usage_aggregates.total_response_time_ms + EXCLUDED.total_response_time_ms,
    error_count = usage_aggregates.error_count + EXCLUDED.error_count
`, [apiKeyId, apiId, year, month, responseTimeMs, statusCode >= 400 ? 1 : 0]);
```

**Why Right:** Both solutions use atomic operations. The database handles concurrency via row-level locks. Redis handles it via single-threaded command execution. No lost updates.

---

## BUG-003: Tier Enforcement Bypass via Client Header

### WHAT

Consumers can override their subscription tier limits by sending a custom HTTP header, effectively upgrading to premium without paying.

### WHY IT EXISTS

The quota endpoint trusts client-provided data (the `x-tier-override` header) instead of looking up the actual tier from the validated API key.

### HOW IT WORKS

```typescript
// In usage/src/routes/quotas.ts
router.get('/:apiKeyId', (req, res) => {
  // BUG: Reading tier from untrusted client header!
  const requestedTier = req.headers['x-tier-override'] as string;
  let limit = 1000; // default
  
  if (requestedTier === 'premium') {
    limit = 100000; // Premium quota!
  } else if (requestedTier === 'pro') {
    limit = 50000;
  }
  
  res.json({ limit, tier: requestedTier });
});
```

**Attack Scenario:**
1. Consumer subscribes to Free tier (1,000 requests/month)
2. Consumer sends requests with header: `x-tier-override: premium`
3. Quota endpoint returns limit: 100,000
4. Consumer makes 50,000 requests
5. Billing only charges for Free tier because it uses correct tier data
6. Developer loses revenue, consumer gets premium service for free

### WRONG vs RIGHT

**WRONG:**
```typescript
// Trusting client-provided tier
const requestedTier = req.headers['x-tier-override'];
let limit = getLimitForTier(requestedTier); // Client controls their own limit!
```

**RIGHT:**
```typescript
// Server-side tier resolution from validated key
async function getQuota(req: Request, res: Response) {
  const { apiKeyId } = req.params;
  
  // Look up the key to get its actual tier
  const apiKey = await authService.getKey(apiKeyId);
  if (!apiKey || apiKey.status !== 'active') {
    return res.status(401).json({ error: 'Invalid or expired key' });
  }
  
  // Look up the tier from the billing service (source of truth)
  const tier = await billingService.getTier(apiKey.tierId);
  if (!tier) {
    return res.status(500).json({ error: 'Tier configuration not found' });
  }
  
  // Get actual usage for this key
  const aggregate = await usageService.getAggregate(apiKeyId, apiKey.apiId);
  const used = aggregate ? aggregate.totalRequests : 0;
  
  res.json({
    apiKeyId,
    apiId: apiKey.apiId,
    tierId: tier.id,
    tierName: tier.name,
    used,
    limit: tier.requestsPerMonth, // Server decides, not client
    remaining: Math.max(0, tier.requestsPerMonth - used)
  });
}
```

**Why Right:** The tier information flows from Auth Service (key validation) -> Billing Service (tier lookup). The client cannot influence this chain. The `x-tier-override` header is completely ignored.

---

## Detection and Prevention

### Static Analysis

Use ESLint rules to catch common security issues:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-properties': ['error', {
      object: 'req',
      property: 'headers',
      message: 'Always validate headers, never trust client input for security decisions'
    }]
  }
};
```

### Testing Strategy

1. **Concurrent Load Tests:** Always test aggregation with `Promise.all([...Array(100)])`
2. **Authorization Matrix Tests:** Test every endpoint with keys from different developers
3. **Header Manipulation Tests:** Test with forged headers for tier, user ID, roles
4. **Fuzz Tests:** Randomize inputs to find trust boundary violations

### Code Review Checklist

- [ ] Is client input ever used for authorization decisions?
- [ ] Are there read-modify-write operations on shared state?
- [ ] Does every resource access check ownership?
- [ ] Are all security checks on the server side?
- [ ] Can headers or query params bypass rate limits or quotas?
