# v7 — Production Setup (Weather Cache)

## The Scenario

It's 2am. Your junior deploys the weather API. "Cache works!" they say. Then OpenWeatherMap goes down. Your app returns 503s to everyone — even users who had cached data from 5 minutes ago. "Why didn't we serve stale cache?" the junior asks. You check: no stale-while-revalidate fallback was implemented.

## The PAIN: Cache Without Fallback Is Half a Cache

From v6:

```typescript
// Naive cache:
const cached = await getCachedWeather(city);
if (cached) {
  res.json(cached);
  return;
}
const data = await fetchWeatherFromApi(city);
await setCachedWeather(city, data);
res.json(data);
```

Problems:
- Cache expires → immediate API call
- API down → 500 error
- No stale data → every user suffers during outages
- No TTL → cache grows forever (if using Map instead of Redis)

## The Solution: Redis + Cache-Aside + Stale-While-Revalidate

### 1. Cache Service (Redis-Backed)

```typescript
// src/services/cache.ts (actual production code)
import Redis from 'ioredis';
import { REDIS_URL, REDIS_TTL_SECONDS } from '../config.js';
import { WeatherData } from '../types.js';

const redis = new Redis(REDIS_URL);

export function getCacheKey(city: string): string {
  return `weather:${city.toLowerCase().trim()}`;
}

export async function getCachedWeather(city: string): Promise<WeatherData | null> {
  const key = getCacheKey(city);
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as WeatherData;
  } catch {
    return null;
  }
}

export async function setCachedWeather(city: string, data: WeatherData): Promise<void> {
  const key = getCacheKey(city);
  await redis.setex(key, REDIS_TTL_SECONDS, JSON.stringify(data));
}
```

Why Redis?
- **TTL**: `SETEX` auto-expires keys
- **Distributed**: Shared across server instances
- **Fast**: In-memory, sub-millisecond lookups
- **Persistent**: Optional disk backup (vs Node's heap)

### 2. Weather API Client

```typescript
// src/services/weatherApi.ts (actual production code)
import { WeatherData } from '../types.js';
import { MOCK_API_DELAY_MS } from '../config.js';

let shouldFailNext = false;

export function setNextRequestShouldFail(value: boolean): void {
  shouldFailNext = value;
}

export async function fetchWeatherFromApi(city: string): Promise<WeatherData> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_API_DELAY_MS));

  if (shouldFailNext) {
    shouldFailNext = false;
    throw new Error('External weather API is unavailable');
  }

  return {
    city,
    temperature: Math.round(10 + Math.random() * 20),
    condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
    humidity: Math.round(40 + Math.random() * 50),
    windSpeed: Math.round(5 + Math.random() * 20),
    fetchedAt: new Date().toISOString(),
  };
}
```

### 3. Route with Cache-Aside + Stale-While-Revalidate

```typescript
// src/routes/weather.ts (actual production code)
import { Router, Request, Response } from 'express';
import { getCachedWeather, setCachedWeather } from '../services/cache.js';
import { fetchWeatherFromApi } from '../services/weatherApi.js';
import { WeatherData } from '../types.js';
import { STALE_THRESHOLD_MS } from '../config.js';

const router = Router();

router.get('/weather/:city', async (req: Request, res: Response) => {
  const city = req.params.city;

  try {
    const cached = await getCachedWeather(city);
    const now = Date.now();

    if (cached) {
      const ageMs = now - new Date(cached.fetchedAt).getTime();
      if (ageMs < STALE_THRESHOLD_MS) {
        res.json({ source: 'cache', ...cached });
        return;
      }
      // Cache is stale (> 10 min) — fall through to revalidate
    }

    // BUG: No distributed lock / mutex here.
    // If many concurrent requests arrive when cache is stale,
    // they will all call the external API simultaneously (cache stampede).
    const data: WeatherData = await fetchWeatherFromApi(city);

    await setCachedWeather(city, data);

    res.json({ source: 'api', ...data });
  } catch (err) {
    console.error('Weather fetch error:', err);

    // Serve stale cache if available (stale-while-revalidate fallback)
    const stale = await getCachedWeather(city);
    if (stale) {
      res.json({
        source: 'stale_cache',
        ...stale,
        warning: 'Data may be outdated due to weather service interruption',
      });
      return;
    }

    res.status(503).json({
      error: 'Weather service unavailable. Please try again later.',
    });
  }
});
```

### 4. Cache Strategy Explained

```
User requests /weather/London
│
├─ Cache hit (fresh, < 10 min)
│  └─ Return from Redis immediately (< 1ms)
│
├─ Cache stale (10-60 min old)
│  └─ Call external API
│  └─ Update Redis
│  └─ Return fresh data
│
├─ API fails
│  └─ Serve stale cache if available
│  └─ Return 503 only if no cache at all
│
└─ Cache miss + API fails
   └─ Return 503
```

### 5. The Stampede Bug (Intentionally Documented)

```typescript
// When cache expires, 100 concurrent requests all see "stale cache"
// and all call the external API simultaneously.
// Fix: Add Redis distributed lock (Redlock) or singleflight pattern.
```

The test documents this:
```typescript
it('BUG: cache stampede — concurrent requests trigger multiple API calls', async () => {
  // 10 concurrent requests → multiple API calls expected
  const apiSources = responses.filter(r => r.body.source === 'api').length;
  expect(apiSources).toBeGreaterThan(1);
});
```

### 6. Configuration

```typescript
// src/config.ts
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const PORT = process.env.PORT || 3000;
export const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const REDIS_TTL_SECONDS = 60 * 60; // 1 hour (retention for stale fallback)
export const MOCK_API_DELAY_MS = 100;
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Cache | None | Redis with TTL |
| Strategy | None | Cache-aside |
| Fallback | None | Stale-while-revalidate |
| Key normalization | None | Lowercase + trim |
| API failure handling | 500 error | Stale cache fallback |
| Types | None | TypeScript |
| Tests | None | Vitest (documents stampede) |
| Module system | CommonJS | ESM |

## The Realization

> Junior: "I saw the stale-while-revalidate pattern save us during a mock outage. Users got slightly old data instead of errors. That's the difference between a robust system and a fragile one."
> 
> You: "Caching isn't just about speed — it's about resilience. A cache that can't serve stale data during an outage is just a performance optimization. A cache that degrades gracefully is architecture."

## Files in this project

```
S03-weather-cache/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express setup
│   ├── config.ts             # Environment config
│   ├── types.ts              # WeatherData interface
│   ├── routes/
│   │   └── weather.ts        # Route with cache-aside logic
│   └── services/
│       ├── cache.ts          # Redis operations
│       └── weatherApi.ts     # External API client
├── tests/
│   └── weather.test.ts       # Vitest (documents stampede)
├── package.json              # ESM
└── tsconfig.json
```

## What You Learned

1. **Cache-aside pattern**: Application manages cache explicitly (vs read-through/write-behind)
2. **TTL is not enough**: Data can be stale before TTL expires. Check freshness separately.
3. **Graceful degradation**: Stale data is better than no data. Users prefer outdated weather to an error page.
4. **Cache stampede is real**: High-traffic + cache expiration = thundering herd. Plan for it.
5. **Normalization matters**: `London` and `london` must hit the same cache key.
