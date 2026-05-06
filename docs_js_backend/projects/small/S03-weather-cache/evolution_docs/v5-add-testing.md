# v5 — Add Testing (Weather Cache)

## The Scenario

It's 2am. Your junior refactors the cache service. "I'm just cleaning up," they say. They change `setex` to `set` with `EX`. Deploy. Cache never expires. API quota burned in hours. They never tested cache TTL.

## The PAIN: Cache Logic Is Easy to Break

From v4:

```typescript
// services/cache.ts
export async function setCachedWeather(city: string, data: WeatherData): Promise<void> {
  const key = getCacheKey(city);
  await redis.setex(key, REDIS_TTL_SECONDS, JSON.stringify(data));
}
```

One character change (`setex` → `set`) and cache becomes permanent. No expiration. No stale data. Just an ever-growing Redis database.

Without tests, you find out via your API provider's overage bill.

## The Solution: Vitest + Redis + Time Control

```typescript
// tests/weather.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { clearCache, quitRedis, setCachedWeatherRaw } from '../src/services/cache.js';
import { setNextRequestShouldFail } from '../src/services/weatherApi.js';

describe('GET /weather/:city', () => {
  beforeAll(async () => {
    await clearCache();
  });

  afterAll(async () => {
    await quitRedis();
  });

  it('fetches from API on cache miss', async () => {
    const res = await request(app).get('/weather/London');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('api');
    expect(res.body.city).toBe('London');
  });

  it('returns cached data on subsequent request', async () => {
    await request(app).get('/weather/Paris'); // Prime cache
    const res = await request(app).get('/weather/Paris');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('cache');
  });

  it('returns stale cache when external API fails', async () => {
    const city = 'ErrorCity';
    await setCachedWeatherRaw(city, {
      city,
      temperature: 20,
      condition: 'Sunny',
      humidity: 50,
      windSpeed: 10,
      fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min old
    });
    
    setNextRequestShouldFail(true);
    
    const res = await request(app).get(`/weather/${city}`);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('stale_cache');
    expect(res.body.temperature).toBe(20);
  });

  it('returns 503 when API fails and no cache exists', async () => {
    const city = 'NoCacheCity';
    setNextRequestShouldFail(true);
    
    const res = await request(app).get(`/weather/${city}`);
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('unavailable');
  });

  // Documents the stampede bug
  it('BUG: cache stampede — concurrent requests trigger multiple API calls', async () => {
    await clearCache();
    const city = 'StampedeCity';
    
    await setCachedWeatherRaw(city, {
      city,
      temperature: 15,
      condition: 'Cloudy',
      humidity: 60,
      windSpeed: 12,
      fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });
    
    const requests = Array.from({ length: 10 }, () =>
      request(app).get(`/weather/${city}`)
    );
    
    const responses = await Promise.all(requests);
    const apiSources = responses.filter((r) => r.body.source === 'api').length;
    
    expect(apiSources).toBeGreaterThan(1);
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Cache TTL broken | API overage bill | **Test checks** expiration |
| Stale cache ignored | 500s when API down | **Test verifies** stale fallback |
| No cache fallback | 500s for new cities | **Test verifies** 503 with message |
| Cache stampede | API quota burned | **Test documents** concurrent API calls |
| City normalization broken | Duplicate cache keys | **Test checks** case-insensitive keys |

## The PAIN of Time-Dependent Tests

```typescript
// DON'T use real timers:
await new Promise(r => setTimeout(r, 60000)); // Wait 1 minute for cache to expire
// Tests take forever. Flaky in CI.

// DO use fake timers (if needed):
vi.useFakeTimers();
vi.advanceTimersByTime(11 * 60 * 1000); // Advance 11 minutes
// Instant. Deterministic.
```

Our tests use `setCachedWeatherRaw` to inject stale data directly, avoiding real-time waits.

## Testing Evolution in Weather Cache

| Version | Testing | Cache confidence |
|---------|---------|-----------------|
| v1 (JS) | Manual browser refresh | Zero |
| v2-4 | Still manual | Zero |
| v5 (Vitest) | Hit/miss/stale/failure tested | High |

## The Realization

> Junior: "I wrote a test that injects 20-minute-old cache data and forces the API to fail. The test proves stale-while-revalidate works. Without it, I'd only know during a real outage."
> 
> You: "Cache logic is deterministic. It either works or it doesn't. Tests for caching are some of the most valuable tests you can write because cache bugs are silent — they don't crash, they just waste money and provide bad data."

## The Next PAIN

Tests run in Node. But if your codebase mixes CommonJS (`require`) and ESM (`import`), test runners get confused. Files import `.js` extensions that don't exist. Dynamic imports fail. The module system wars begin.

## Next: v6 — Switch to ESM
