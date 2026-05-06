# S03 Weather Cache — Overview

## Project Goal
Provide a weather lookup endpoint that caches external API responses to reduce latency, cost, and dependency on a third-party service.

## Architecture
```
Client → GET /weather/:city
         └── weather route
              ├── getCachedWeather(city)
              │   └── Redis GET weather:<city>
              ├── If fresh: return cache
              ├── If stale or missing:
              │   ├── fetchWeatherFromApi(city)   ← BUG: no lock
              │   ├── setCachedWeather(city, data)
              │   └── return API data
              └── On API failure:
                  └── Serve stale cache if available
```

## Tech Stack
- **Runtime**: Node.js + Express + TypeScript
- **Cache**: Redis (ioredis)
- **External API**: Simulated weather service (mocked delay + random failure)

## What This Project Demonstrates
1. Cache-aside (lazy-loading) pattern
2. TTL-based expiration
3. Stale-while-revalidate fallback
4. Cache stampede vulnerability (intentional bug)

## Quick Start
```bash
npm install
# Start Redis, then:
npm run dev
```

## File Map
| File | Responsibility |
|------|----------------|
| `src/routes/weather.ts` | Route logic, freshness check, fallback |
| `src/services/cache.ts` | Redis read/write helpers |
| `src/services/weatherApi.ts` | Simulated external API client |
| `src/config.ts` | TTL, stale threshold, mock delay |
| `tests/weather.test.ts` | Integration tests |

## Production Checklist
- [ ] Fix cache stampede with distributed lock or probabilistic early refresh
- [ ] Add circuit breaker for external API
- [ ] Monitor cache hit rate
- [ ] Add request-level timeouts
