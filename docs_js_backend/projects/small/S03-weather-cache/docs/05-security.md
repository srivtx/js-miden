# S03 Weather Cache — Security

## Intentional Bug: Cache Stampede (No Distributed Lock)

**Location**: `src/routes/weather.ts`, lines 25-28

```ts
// BUG: No distributed lock / mutex here.
// If many concurrent requests arrive when cache is stale,
// they will all call the external API simultaneously (cache stampede).
const data: WeatherData = await fetchWeatherFromApi(city);
```

### Real-World Consequence
A popular city like "London" is queried 500 times/second. When the cache turns stale:
1. All 500 requests miss the freshness check.
2. All 500 requests call the external API simultaneously.
3. The weather provider rate-limits or bills you for 500 calls.
4. Your server threads are blocked waiting for 500 API responses.
5. If the API is already slow, requests queue up and timeout, producing 503 cascades.

### Fix
Use Redis `SET NX EX` as a lightweight lock:
```ts
const lockKey = `lock:weather:${city}`;
const lock = await redis.set(lockKey, '1', 'EX', 10, 'NX');
if (lock) {
  try {
    const data = await fetchWeatherFromApi(city);
    await setCachedWeather(city, data);
  } finally {
    await redis.del(lockKey);
  }
} else {
  // Another instance is refreshing; wait and return cached (even if stale)
  await new Promise(r => setTimeout(r, 200));
  const cached = await getCachedWeather(city);
  if (cached) return res.json({ source: 'cache_wait', ...cached });
}
```

## Cache Poisoning

If an attacker controls the API response (e.g., via DNS hijacking or a compromised API key), they can inject malicious data into the cache. The cache will serve poisoned data for the full TTL.

**Mitigation**:
- Validate API response shape with Zod or Joi before caching.
- Use HTTPS with certificate pinning for the upstream API.
- Sign responses if the API supports it.

## Key Collision & Injection

Current key: `weather:${city.toLowerCase().trim()}`

A city name like `london; FLUSHALL` does not execute because Redis clients use binary-safe strings. However, if you ever switch to a naive concatenation in a shell script or log parser, injection becomes possible.

**Best practice**: Sanitize or hash the city segment:
```ts
const key = `weather:${crypto.createHash('sha256').update(city).digest('hex').slice(0,16)}`;
```

## Information Leakage via Timing

An attacker can probe which cities have been queried by measuring response time:
- Cache hit: ~2 ms
- Cache miss: ~100 ms

This reveals user interest patterns (e.g., "Has someone searched for `pentagon`?").

**Mitigation**: Add a random delay (0-50 ms) to all responses, or use a constant-time path. This is usually overkill for weather but critical for health-record APIs.

## Redis Security

- **Bind**: Redis should bind to `127.0.0.1` or a private VPC interface, never `0.0.0.0` without AUTH.
- **AUTH**: Enable `requirepass` or use Redis ACLs.
- **TLS**: Use `rediss://` (TLS) for cross-network connections.
- **Command restrictions**: Disable dangerous commands (`FLUSHALL`, `CONFIG SET`) via `rename-command`.
