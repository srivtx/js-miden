# S03 Weather Cache — Key Concepts

## 1. Cache-Aside Pattern (Lazy Loading)

The application checks the cache first; on a miss, it fetches from the source and populates the cache.

```
App → Cache? → Yes → Return
          ↓ No
        Source → Cache → Return
```

**Why it exists**: The application owns the cache logic. It works with any data store (SQL, REST, file system) without modifying the store.

**Alternatives**:
- **Read-through**: Cache library fetches automatically on miss. Tighter coupling.
- **Write-through**: Data written to cache and DB simultaneously. Simpler consistency but slower writes.
- **Write-behind**: Data written to cache, then asynchronously flushed to DB. High throughput but risk of data loss.

Cache-aside is the most flexible and most common for read-heavy, external-API workloads.

## 2. Cache Stampede

When a hot cache key expires, many concurrent requests simultaneously hit the backing store.

```
Req 1 ── Cache miss ──→ API
Req 2 ── Cache miss ──→ API
Req 3 ── Cache miss ──→ API   (all at the same time!)
```

**Consequences**:
- External API rate limit exceeded.
- Server CPU/memory spikes.
- Cascading failure if the API is already struggling.

**Mitigation strategies**:
1. **Distributed lock**: First request acquires a lock; others wait or serve stale.
2. **Probabilistic early refresh**: Each request has a small chance to refresh the cache before TTL expires.
3. **External revalidation**: A background worker refreshes the cache, not user requests.
4. **Lease-based**: Requester gets a short lease to populate; concurrent requests get a "busy" signal and retry.

## 3. TTL Strategies

### Fixed TTL
```ts
redis.setex(key, 600, data); // 10 minutes
```

- **Pros**: Predictable, simple.
- **Cons**: All keys expire at the same time if populated in a batch (thundering herd on refresh).

### Jittered TTL
```ts
const ttl = 600 + Math.floor(Math.random() * 60); // 10-11 minutes
```

- **Pros**: Spreads expiration times, preventing synchronized stampedes.
- **Cons**: Slightly harder to reason about freshness.

### Per-Item TTL
Weather for "London" might update every 15 minutes; "Sahara" every hour.

**Best practice**: Always add jitter to TTLs in production. Redis does not natively support jitter, so the application must compute it.

## 4. Stale-While-Revalidate

The route serves stale data while fetching fresh data in the background.

```ts
if (cacheAge < STALE_THRESHOLD) {
  return freshCache;
}
// Cache is stale — try to refresh
try {
  const fresh = await fetchApi(city);
  await setCache(city, fresh);
  return fresh;
} catch {
  return staleCache; // fallback
}
```

**Why it exists**: Availability trumps freshness for weather data that changes gradually. Users prefer slightly outdated data over an error page.

**HTTP standard**: `Cache-Control: stale-while-revalidate=600` tells CDNs to serve stale for 600 seconds while refreshing.

## 5. External API Failure Handling

### Retry with Backoff
```ts
for (let i = 0; i < 3; i++) {
  try { return await fetchApi(); } catch { await sleep(2 ** i * 100); }
}
```

### Circuit Breaker
After N failures, stop calling the API for a cooldown period.

| State | Behavior |
|-------|----------|
| Closed | Normal operation |
| Open | All requests fail fast; serve stale/cache |
| Half-Open | Allow 1 probe request to test recovery |

Libraries: `opossum` (Node.js), `resilience4j` (Java).

**Why it matters**: Prevents the "retry storm" where every client retries simultaneously, overwhelming a recovering service.

## 6. Cache Key Design

Current key: `weather:${city.toLowerCase().trim()}`

**Problems**:
- No API version — changing response shape invalidates all keys manually.
- No query params — if we later add `units=metric`, keys collide.
- Case sensitivity edge cases: `"São Paulo"` vs `"sao paulo"` (accents).

**Improved key**:
```ts
`weather:v2:${normalize(city)}:${units}`
```

Use a hash (SHA-256) for very long keys to stay within Redis's 512 MB key limit (extreme edge case, but good hygiene).
