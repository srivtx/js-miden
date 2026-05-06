# M03: Senior Engineer Critique

## Overall Assessment

This is a solid, production-reasonable health check implementation for a learning exercise. The caching strategy is appropriate, the timeout configuration is sensible, and the separation of concerns (db.ts, redis.ts, health.ts, index.ts) is clean.

However, several areas would be flagged in a production code review.

---

## Critique 1: Single Endpoint vs Split Probes

**Issue:** We have one `/health` endpoint that serves both liveness and readiness purposes.

**Why it matters:** In Kubernetes, a liveness failure triggers a container restart. A readiness failure removes the pod from the service endpoints. If your database is slow, you do NOT want Kubernetes restarting your perfectly healthy application — you just want traffic routed elsewhere.

**Recommendation:**

```typescript
app.get('/live', (_req, res) => {
  // Process is alive. Cheap. Never fails unless process is dead.
  res.status(200).json({ status: 'alive' });
});

app.get('/ready', async (_req, res) => {
  // Can we serve traffic? Check dependencies.
  const health = await checkHealth();
  const code = health.status === 'healthy' ? 200 : 503;
  res.status(code).json(health);
});
```

**Priority:** Medium. For a learning project, one endpoint is fine. For production Kubernetes deployment, split them.

---

## Critique 2: Cache Invalidation Edge Case

**Issue:** The cache uses `Date.now()`, which is system clock time. If the system clock jumps backward (NTP sync, leap seconds), `now - cachedAt` could be negative, causing unnecessary cache misses.

```typescript
// Potential issue:
const now = Date.now();        // T+5000ms
// NTP adjusts clock backward by 10 seconds
const later = Date.now();      // T-5000ms (in the past!)
later - cachedAt < CACHE_TTL   // false negative, cache treated as stale
```

**Why it matters:** In containerized environments, clock skew is common during VM migrations.

**Recommendation:** Use `process.hrtime.bigint()` or a monotonic timer for cache age, or simply cap the calculation:

```typescript
const age = Math.max(0, now - cachedAt);
if (cachedStatus && age < CACHE_TTL_MS) {
  return cachedStatus;
}
```

**Priority:** Low. `Date.now()` is acceptable for a 5-second cache. For 24-hour caches, use monotonic time.

---

## Critique 3: No Graceful Degradation Information

**Issue:** When Redis is down but the database is up, we return `unhealthy`. But if Redis is only used for caching (not core functionality), the app could still serve requests.

**Current behavior:**
```json
{
  "status": "unhealthy",
  "checks": { "database": "ok", "redis": "error" }
}
```

**Better behavior for some architectures:**
```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "ok", "critical": true },
    "redis": { "status": "error", "critical": false }
  }
}
```

**Recommendation:** Mark checks as `critical` vs `warning`. The load balancer uses critical checks for routing decisions; warnings are for alerting only.

**Priority:** Medium. Depends on whether Redis is a hard dependency.

---

## Critique 4: Error Messages Are Lost

**Issue:** When a check fails, we only know `'error'`. We do not know *why*.

```typescript
try {
  await db.query('SELECT 1');
} catch {
  checks.database = 'error';  // What was the error? Timeout? Auth failure?
}
```

**Why it matters:** During a 3 AM incident, `'error'` tells you nothing. `'connection refused'` means the DB is down. `'password authentication failed'` means your config is wrong. These have different runbooks.

**Recommendation:** Include error details (carefully — do not leak secrets):

```typescript
} catch (err: any) {
  checks.database = 'error';
  checks.databaseError = err.message;  // 'connect ECONNREFUSED 127.0.0.1:5432'
}
```

**Security note:** Sanitize error messages. Never include passwords, connection strings, or stack traces in health responses.

**Priority:** High. This is the difference between a 5-minute fix and a 2-hour investigation.

---

## Critique 5: No Metrics or Logging

**Issue:** The health check returns a response but emits no structured logs or metrics.

**Production requirement:** You need to know:
- How often does the health check fail?
- What is the p99 response time of the health check?
- Which dependency fails most often?

**Recommendation:** Add metrics (Prometheus-style):

```typescript
import { registerHistogram, registerCounter } from './metrics.js';

const healthCheckDuration = registerHistogram('health_check_duration_ms');
const healthCheckFailures = registerCounter('health_check_failures_total', ['dependency']);

export async function checkHealth(): Promise<HealthStatus> {
  const start = Date.now();
  // ... checks ...
  healthCheckDuration.observe(Date.now() - start);
  if (checks.database === 'error') {
    healthCheckFailures.inc({ dependency: 'database' });
  }
}
```

**Priority:** High for production observability. Low for a learning project.

---

## Critique 6: Test Coverage Gap

**Issue:** The tests mock `db.query` and `redis.ping`, but do not test:
1. Cache behavior (two rapid requests should use cache).
2. Cache expiration (request after 5s should re-query).
3. The `clearHealthCache()` function directly.

**Recommendation:**

```typescript
it('uses cache for rapid requests', async () => {
  const spy = vi.spyOn(db, 'query');
  await request(app).get('/health');
  await request(app).get('/health');
  expect(spy).toHaveBeenCalledTimes(1);  // Only one actual DB query
  spy.mockRestore();
});
```

**Priority:** Medium. The cache is a core feature and should be tested.

---

## Summary: Production Readiness Checklist

| Feature | Current | Production Needed |
|---------|---------|-------------------|
| Deep checks | Yes | Yes |
| Timeout configuration | Yes | Yes |
| Caching | Yes | Yes (maybe shorter TTL) |
| Split live/ready endpoints | No | Yes |
| Structured logging | No | Yes |
| Metrics (Prometheus) | No | Yes |
| Error details in response | No | Yes (sanitized) |
| Critical vs non-critical checks | No | Yes |
| Cache monotonic timer | No | Nice to have |
| Rate limiting on /health | No | Yes (prevent abuse) |

**Verdict:** This code is a strong foundation. The architecture is correct. To make it production-grade, add observability, split the endpoints, and enrich the error reporting.
