# S03: Weather Cache API

## Phase 1: Requirements
- **GET /weather/:city** returns weather data
- If cached and < 10 min old, return cached data
- Otherwise fetch from mock external API, cache in Redis, return
- Handle external API failures gracefully

## Phase 2-3: Thinking Framework

### Cache Strategy
- **Cache-aside (lazy loading)**:
  1. Check cache
  2. Cache miss or stale → fetch from API
  3. Store result → return
- **TTL**: 1 hour in Redis (allows stale-while-revalidate fallback)
- **Application staleness threshold**: 10 minutes
  - Data < 10 min old → `source: cache`
  - Data > 10 min old → revalidate; if API fails → `source: stale_cache`

### TTL: 10 Minutes
Weather changes relatively slowly. 10 minutes balances freshness with API load.
In production, this could be tuned per city (e.g., faster updates for storm zones).

### Cache Stampede
**Problem**: If 1000 requests arrive when cache expires, all hit the external API simultaneously.
**Solutions** (not implemented here due to bug):
- **Mutex / distributed lock**: `SET weather:${city}:lock NX EX 30`
- **Single-flight pattern**: Only one request fetches; others wait
- **Early revalidation**: Refresh cache proactively at 90% of TTL

### External API Failure
**Problem**: What if the weather API is down?
**Handling**:
- Try to serve **stale cache** (older than 10 min but < 1 hour)
- If no cache at all, return **503 Service Unavailable**
- Never cache error responses

## Bug
**Cache stampede — no mutex protection.** When cached data is stale, concurrent requests all call `fetchWeatherFromApi()` simultaneously because there is no locking mechanism around the revalidation path.

### Fix
Implement a Redis-based distributed lock:
```ts
const lockKey = `lock:weather:${city}`;
const lock = await redis.set(lockKey, '1', 'EX', 30, 'NX');
if (lock) {
  // Only this request fetches the API
  const data = await fetchWeatherFromApi(city);
  await setCachedWeather(city, data);
  await redis.del(lockKey);
} else {
  // Wait briefly then read from cache
  await sleep(200);
  const data = await getCachedWeather(city);
}
```

## Running
Requires Redis running locally (default port 6379).

```bash
npm install
npm run dev
```

## Testing
```bash
npm test
```
