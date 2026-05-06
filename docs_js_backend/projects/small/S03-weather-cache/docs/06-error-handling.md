# S03 Weather Cache — Error Handling

## External API Failure Cascade

When `fetchWeatherFromApi` throws, the route catches it and attempts stale fallback:

```ts
try {
  const data = await fetchWeatherFromApi(city);
  await setCachedWeather(city, data);
  res.json({ source: 'api', ...data });
} catch (err) {
  const stale = await getCachedWeather(city);
  if (stale) {
    res.json({ source: 'stale_cache', ...stale, warning: '...' });
  } else {
    res.status(503).json({ error: 'Weather service unavailable' });
  }
}
```

This is **stale-while-revalidate** in action. The error path is actually the success path for availability.

## Retry Strategy

Current code: **no retries**. A transient network blip immediately falls through to stale or 503.

| Strategy | Latency Impact | Reliability | Best For |
|----------|----------------|-------------|----------|
| No retry | Fast | Low | Idempotent, low-cost ops |
| Fixed retry (3×) | Moderate | Medium | Stable APIs |
| Exponential backoff | Higher | High | Flaky networks |
| Circuit breaker | Fast after trip | Very high | Protecting downstream |

**Recommendation**: Add 1 immediate retry for weather APIs. Most transient errors resolve within seconds.

## Timeout Handling

Current code: **no timeout** on `fetchWeatherFromApi`. If the API hangs, the request hangs indefinitely (until the load balancer or client gives up).

Fix with `AbortController`:
```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

## Redis Error Handling

If Redis is down:
- `getCachedWeather` returns `null`.
- The route treats it as a cache miss.
- Every request hits the external API.

This is a **cache avalanche** combined with a stampede. Monitor Redis with health checks and degrade to in-memory LRU cache as a fallback.

## Structured Logging

Log every request with context:
```json
{
  "level": "info",
  "msg": "weather_request",
  "city": "london",
  "source": "cache",
  "duration_ms": 2.1,
  "cache_age_ms": 450000
}
```

This enables debugging hit rates, API latency trends, and stampede detection.

## Graceful Shutdown

On `SIGTERM`:
1. Stop accepting HTTP requests.
2. Finish in-flight API calls (do not abort; they may be populating cache).
3. Close Redis connection (`redis.quit()`).

This prevents half-written cache entries.
