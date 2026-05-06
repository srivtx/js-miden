# 04 - Usage Service

## WHAT

The Usage Service tracks every API call made through the Gateway. It maintains both granular request records and aggregated monthly statistics used for billing and quota enforcement.

**Responsibilities:**
- Record individual usage events (API call metadata)
- Aggregate usage by API key + API + month
- Enforce monthly quota limits
- Provide real-time usage statistics
- Alert when thresholds are approaching

## WHY

### Why Separate Tracking from Billing?

Usage tracking must be fast and always available. Billing calculations can be slow and run asynchronously. Separating them:
- Prevents billing bugs from breaking API access
- Allows usage data to be used for non-billing purposes (analytics, debugging)
- Enables billing to be replayed from raw usage if calculations change

### Why Aggregate Monthly?

Billing cycles are monthly. Aggregating by month:
- Makes invoice generation O(1) instead of O(n) where n = number of requests
- Reduces storage size (1 aggregate per month vs. millions of individual records)
- Enables fast quota checks without scanning raw records

### Why Track Response Time and Errors?

These metrics are essential for:
- **SLA monitoring:** "99th percentile response time < 200ms"
- **Developer dashboards:** "Your API has 0.5% error rate this month"
- **Tier differentiation:** Premium tiers might guarantee lower latency

## HOW

### Usage Event Structure

```typescript
interface UsageRecord {
  id: string;              // Unique event ID
  apiKeyId: string;        // Which key made the request
  apiId: string;           // Which API was called
  developerId: string;     // Who owns the API (for billing)
  endpoint: string;        // /users, /orders, etc.
  method: string;          // GET, POST, etc.
  statusCode: number;      // 200, 404, 500, etc.
  responseTimeMs: number;  // How long the request took
  timestamp: Date;         // When it happened
}
```

### Aggregation Process

```typescript
interface UsageAggregate {
  apiKeyId: string;
  apiId: string;
  year: number;
  month: number;
  totalRequests: number;
  totalResponseTimeMs: number;  // Sum for average calculation
  errorCount: number;
}
```

Aggregation key: `{apiKeyId}:{apiId}:{year}-{month}`

### Quota Check Flow

```
Incoming request
    |
    v
Fetch aggregate for current month
    |
    v
Compare totalRequests against tier limit
    |
    v
If exceeded: reject with 429 + Upgrade header
If within limit: allow and increment counter
```

## WRONG vs RIGHT

### WRONG: Non-Atomic Read-Modify-Write

```typescript
// WRONG: The bug in our current implementation
let aggregate = aggregates.get(aggregateKey);
if (!aggregate) {
  aggregate = createNewAggregate();
  aggregates.set(aggregateKey, aggregate);
}

// Race condition here!
// Thread A reads count=5
// Thread B reads count=5
// Thread A writes count=6
// Thread B writes count=6 (should be 7!)
aggregate.totalRequests += 1;
```

**Why Wrong:** Under concurrent load (which is normal for an API marketplace), requests are lost. A consumer making 1000 requests might only be billed for 950. Or a quota check might pass when it should fail because the counter is behind.

**Impact:** Revenue loss, quota bypass, inconsistent billing.

### RIGHT: Atomic Increment with Redis

```typescript
// RIGHT: Using Redis INCR (atomic operation)
async function trackUsageAtomic(record: UsageRecord): Promise<void> {
  const aggregateKey = `usage:${record.apiKeyId}:${record.apiId}:${year}-${month}`;
  
  // Atomic increment - no race conditions
  const newCount = await redis.hincrby(aggregateKey, 'totalRequests', 1);
  await redis.hincrby(aggregateKey, 'totalResponseTimeMs', record.responseTimeMs);
  
  if (record.statusCode >= 400) {
    await redis.hincrby(aggregateKey, 'errorCount', 1);
  }
  
  // Set expiration to auto-cleanup after 13 months
  await redis.expire(aggregateKey, 13 * 30 * 24 * 60 * 60);
  
  // Check quota immediately after increment
  const tierLimit = await getTierLimit(record.apiKeyId);
  if (newCount > tierLimit) {
    await triggerQuotaExceededWebhook(record);
  }
}
```

**Why Right:** `HINCRBY` is atomic. Even with 10,000 concurrent requests, the counter is exact. No lost updates.

### WRONG: In-Memory Aggregation Only

```typescript
// WRONG: Aggregates only in process memory
const aggregates = new Map<string, UsageAggregate>();
// Lost on restart, not shared across instances
```

**Why Wrong:** If the Usage service restarts, all monthly aggregates are lost. In a multi-instance deployment, each instance has partial data.

### RIGHT: Persistent Storage with Cache

```typescript
// RIGHT: PostgreSQL for persistence, Redis for speed
async function getAggregate(apiKeyId, apiId, year, month) {
  const cacheKey = `agg:${apiKeyId}:${apiId}:${year}-${month}`;
  
  // Check Redis first
  let aggregate = await redis.hgetall(cacheKey);
  if (aggregate && Object.keys(aggregate).length > 0) {
    return aggregate;
  }
  
  // Fallback to database
  aggregate = await db.query(
    'SELECT * FROM usage_aggregates WHERE api_key_id = ? AND api_id = ? AND year = ? AND month = ?',
    [apiKeyId, apiId, year, month]
  );
  
  // Populate cache
  if (aggregate) {
    await redis.hset(cacheKey, aggregate);
    await redis.expire(cacheKey, 3600);
  }
  
  return aggregate;
}
```

**Why Right:** Data survives restarts. Cache provides sub-millisecond reads. Database is the source of truth.

### WRONG: Quota Enforcement in Gateway Only

```typescript
// WRONG: Gateway checks quota, Usage service just tracks
const aggregate = await usageClient.get(`/quotas/${apiKeyId}`);
if (aggregate.used >= tier.limit) {
  return res.status(429).json({ error: 'Quota exceeded' });
}
// Then Usage service separately increments
await usageClient.post('/track', record);
```

**Why Wrong:** Race condition between check and increment. Two requests can both pass the check, then both increment, causing a 1-request overage.

### RIGHT: Check-and-Set with Lua Script

```typescript
// RIGHT: Atomic check-and-increment
const result = await redis.eval(`
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local current = redis.call('HGET', key, 'totalRequests')
  current = tonumber(current) or 0
  
  if current >= limit then
    return {0, current} -- rejected
  end
  
  redis.call('HINCRBY', key, 'totalRequests', 1)
  return {1, current + 1} -- accepted
`, 1, aggregateKey, tierLimit);

const [allowed, newCount] = result;
if (!allowed) {
  return res.status(429).json({ error: 'Quota exceeded', current: newCount });
}
```

**Why Right:** The check and increment happen in a single atomic operation. No request can slip through.

### WRONG: Tier Override via Client Header

```typescript
// WRONG: Accepting tier override from client
const requestedTier = req.headers['x-tier-override'];
if (requestedTier === 'premium') {
  limit = 100000;
}
```

**Why Wrong:** Any client can claim to be premium by setting a header. The tier should be determined server-side from the validated API key.

### RIGHT: Server-Side Tier Resolution

```typescript
// RIGHT: Look up tier from the validated key
const keyInfo = await authClient.validate(req.headers['x-api-key']);
const tier = await billingClient.get(`/tiers/${keyInfo.tierId}`);
const limit = tier.requestsPerMonth; // Server decides, not client
```

**Why Right:** The client cannot influence their tier. The tier ID comes from the key validation response, which is cryptographically verified.
