# v4 — Add Logging (Weather Cache)

## The Scenario

It's 2am. Users report "weather is showing old data." Your junior checks the app — it works fine. They check the cache — Redis is up. They check the API — OpenWeatherMap has a 2-hour outage. "How did we not know?" they ask. You check the logs. There are no logs.

## The PAIN: Invisible Failures

From v3:

```typescript
router.get('/weather/:city', async (req, res) => {
  try {
    const cached = await getCachedWeather(city);
    // ...
    const data = await fetchWeatherFromApi(city);
    await setCachedWeather(city, data);
    res.json({ source: 'api', ...data });
  } catch (err) {
    console.error('Weather fetch error:', err);
    // ^ This goes to stdout. Docker swallows it. You'll never see it.
    
    const stale = await getCachedWeather(city);
    if (stale) {
      res.json({ source: 'stale_cache', ...stale });
      return;
    }
    res.status(503).json({ error: 'Unavailable' });
  }
});
```

### What breaks in production:

1. **No cache hit/miss visibility**: Is the cache working? You don't know. No metrics.

2. **No API failure tracking**: OpenWeatherMap returns 500s. Your stale cache serves old data. Users don't complain immediately. You don't know the API is down.

3. **No latency monitoring**: Cache hits should be <5ms. API calls are 200-800ms. Without timing data, you can't optimize.

4. **No correlation**: User says "weather was wrong at 3pm." You have no request ID to trace.

## The Solution: Structured Logging with Cache Metrics

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});
```

```typescript
// routes/weather.ts
import { logger } from '../logger.js';

router.get('/weather/:city', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, city, route: 'GET /weather/:city' });
  const startTime = Date.now();
  
  try {
    const cached = await getCachedWeather(city);
    const now = Date.now();
    
    if (cached) {
      const ageMs = now - new Date(cached.fetchedAt).getTime();
      if (ageMs < STALE_THRESHOLD_MS) {
        childLogger.info({ source: 'cache', ageMs, cacheHit: true }, 'Cache hit');
        res.json({ source: 'cache', ...cached });
        return;
      }
      childLogger.info({ source: 'stale', ageMs }, 'Cache stale, revalidating');
    } else {
      childLogger.info({ source: 'miss' }, 'Cache miss');
    }
    
    const data = await fetchWeatherFromApi(city);
    await setCachedWeather(city, data);
    
    const duration = Date.now() - startTime;
    childLogger.info({ source: 'api', durationMs: duration }, 'API fetch successful');
    
    res.json({ source: 'api', ...data });
  } catch (err) {
    const duration = Date.now() - startTime;
    childLogger.error({ err, durationMs: duration }, 'API fetch failed');
    
    const stale = await getCachedWeather(city);
    if (stale) {
      childLogger.warn({ ageMs: Date.now() - new Date(stale.fetchedAt).getTime() }, 'Serving stale cache');
      res.json({ source: 'stale_cache', ...stale, warning: 'Data may be outdated' });
      return;
    }
    
    childLogger.error('No cache available, service unavailable');
    res.status(503).json({ error: 'Weather service unavailable' });
  }
});
```

### What structured logging gives you:

| Metric | console.log | Structured logger |
|--------|------------|-------------------|
| Cache hit rate | ❌ Guess from Redis INFO | ✓ Query `cacheHit: true` vs `source: 'api'` |
| API downtime | ❌ Users complain first | ✓ Alert on error rate |
| Latency p95 | ❌ No timing | ✓ `durationMs` histogram |
| Stale cache usage | ❌ Invisible | ✓ Warn logs with age |
| Request tracing | ❌ None | ✓ `requestId` correlation |

## The PAIN of Cache Stampede

```typescript
// Without logging:
// 10 concurrent requests see stale cache
// All 10 call the API simultaneously
// Your API quota burns in 1 second

// With logging:
// You see 10 simultaneous `source: 'api'` logs for the same city
// Pattern emerges: cache stampede detected
```

Logging reveals architectural problems that are invisible in development.

## Logging Evolution in Weather Cache

| Version | Logging | Cache observability |
|---------|---------|---------------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral |
| v3 (Validation) | console.log | Same problems |
| v4 (Structured) | JSON with cache metrics | Full visibility |

## The Realization

> Junior: "I set up Pino and saw that our cache hit rate is only 40%. Turns out case sensitivity was creating duplicate keys. Fixed it."
> 
> You: "Logs aren't just for debugging — they're for discovery. Metrics buried in structured logs reveal behavior you never anticipated."

## The Next PAIN

Logging shows you problems. Testing prevents them. How do you know your stale-while-revalidate fallback works? How do you know cache TTL is respected? You test it.

## Next: v5 — Add Testing
