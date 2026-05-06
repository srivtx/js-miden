# M03: Architecture Decisions

## Decision 1: Shallow vs Deep Health Checks

### Shallow (Process-Only) Check

```typescript
// Shallow: Only checks if Node.js is running
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});
```

**Pros:**
- Extremely fast (< 1ms)
- Zero load on dependencies
- Cannot fail due to network issues

**Cons:**
- Lies about actual health. The process can be alive while the database is down.
- Load balancer sends real user traffic to broken instances.
- During an incident, you cannot distinguish "app bug" from "database outage."

**When to use:** As a `/live` probe for Kubernetes. If the process is alive, do not restart it. But do NOT use this for load balancer health checks.

### Deep (Dependency-Aware) Check

```typescript
// Deep: Verifies actual functionality of dependencies
const dbOk = await db.query('SELECT 1').then(() => true).catch(() => false);
const redisOk = await redis.ping().then(() => true).catch(() => false);
const healthy = dbOk && redisOk;
```

**Pros:**
- Accurate. If it says healthy, the app can actually serve requests.
- Reduces user-facing errors by routing traffic only to working instances.
- Provides detailed debugging information during incidents.

**Cons:**
- Adds load to dependencies (mitigated by caching).
- Slower (mitigated by timeouts).
- Can fail due to transient network blips, causing unnecessary failovers.

**When to use:** For load balancer health checks and readiness probes.

### Our Decision

**Deep check with 5-second cache.** We choose accuracy over speed because:
1. A single `SELECT 1` and `PING` every 5 seconds is negligible load.
2. User-facing 500 errors are more expensive than a health check.
3. The 5-second cache prevents health check DDOS.

---

## Decision 2: Timeout Strategy

### Option A: Global Timeout (Entire Health Check)

```typescript
const health = await Promise.race([
  checkHealth(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
]);
```

**Problem:** If the global timeout fires, we do not know which dependency was slow. We lose debugging information.

### Option B: Per-Dependency Timeout

```typescript
const dbPromise = db.query('SELECT 1');
const redisPromise = redis.ping();

// Each has its own timeout configured in the client
// DB: connectionTimeoutMillis: 5000
// Redis: connectTimeout: 5000
```

**Advantages:**
- We know exactly which dependency failed.
- We can set different timeouts for different services (e.g., external APIs get 10s, DB gets 2s).
- Partial results are still useful: "Redis is fine, but DB is slow."

### Our Decision

**Per-dependency timeouts configured in the connection clients.** The database pool and Redis client each have their own 5-second connection timeout. The route handler has a `try/catch` for the aggregate result.

---

## Decision 3: Caching Health Status

### Option A: No Cache

Every health check request queries the database and Redis.

**Load calculation:**
- 10 instances
- Load balancer checks every 5 seconds
- Monitoring system checks every 10 seconds
- Total: ~10 × (1/5 + 1/10) = 3 health checks per second
- 3 `SELECT 1` per second × 86,400 seconds = 259,200 queries per day

That is not catastrophic, but it is wasteful. In larger systems (100 instances, multiple monitoring tools), health checks can become a significant DB load.

### Option B: Cache for 5 Seconds

```typescript
let cachedStatus: HealthStatus | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

if (cachedStatus && Date.now() - cachedAt < CACHE_TTL_MS) {
  return cachedStatus;
}
```

**Trade-offs:**
- **Pro:** Reduces dependency load by 99%+ (from every request to every 5 seconds).
- **Con:** 5-second stale data window during incidents.

### Option C: Reactive Cache Invalidation

Cache until a dependency error is detected in user-facing code, then invalidate the cache immediately.

**Problem:** Couples user request handling to health check logic. Adds complexity. The 5-second window is acceptable for most systems.

### Our Decision

**5-second time-based cache.** Simple, effective, and the stale window is an acceptable trade-off for the load reduction. The cache is stored in memory (two variables), so there is no distributed cache consistency problem.

```
┌──────────────────────────────────────────────┐
│  Cache Hit (99% of requests)                 │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐ │
│  │ Request │───▶│ Cache OK?│───▶│ Return  │ │
│  │ Arrives │    │ < 5s old │    │ Cached  │ │
│  └─────────┘    └──────────┘    └─────────┘ │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Cache Miss (1% of requests)                 │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐ │
│  │ Request │───▶│ Cache OK?│───▶│ Query   │ │
│  │ Arrives │    │ > 5s old │    │ DB+Redis│ │
│  └─────────┘    └──────────┘    └─────────┘ │
│                                      │       │
│                                      ▼       │
│                               ┌──────────┐   │
│                               │ Update   │   │
│                               │ Cache    │   │
│                               └──────────┘   │
└──────────────────────────────────────────────┘
```
