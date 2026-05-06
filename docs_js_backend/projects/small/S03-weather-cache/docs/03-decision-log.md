# S03 Weather Cache — Decision Log

## Decision: Cache-Aside vs Read-Through

| Approach | Control | Complexity | Best For |
|----------|---------|------------|----------|
| Cache-Aside | Full (app decides when to cache) | Low | Heterogeneous data sources |
| Read-Through | Cache library handles miss | Medium | Homogeneous, simple schemas |
| Write-Through | Always consistent | High | Write-heavy, consistency-critical |

We chose cache-aside because:
1. The external API is a black box we do not control.
2. We want stale-while-revalidate logic inside the route, not hidden in a cache library.
3. It is the de-facto standard for proxying third-party APIs.

## Decision: Redis vs In-Memory Cache

| Approach | Latency | Shared? | Durability | Best For |
|----------|---------|---------|------------|----------|
| Node `Map` | <1 µs | No (per process) | None | Single-instance prototypes |
| `node-cache` | <1 µs | No | None | Low-scale, single-node |
| Redis | ~1 ms | Yes | RDB/AOF | Multi-instance production |
| Memcached | ~1 ms | Yes | None | Pure caching, no data structures |

We chose Redis because the app is designed to run behind a load balancer. In-memory caches would produce cache misses on every request routed to a different instance.

Memcached is also valid, but Redis adds:
- Data structures (hashes, sorted sets) for future features.
- Persistence options for warm restarts.
- Better client ecosystem in Node.js (`ioredis`).

## Decision: JSON String vs Redis Hash

| Format | Read Speed | Write Speed | Memory | Flexibility |
|--------|------------|-------------|--------|-------------|
| JSON string | Fast (single GET) | Fast (single SET) | Moderate | Must fetch whole object |
| Redis Hash | Moderate (HGETALL) | Moderate (HMSET) | Better | Can update single fields |
| RedisJSON | Fast | Fast | Moderate | Native JSONPath queries |

We chose JSON string because:
- The weather object is small (<1 KB).
- We always read/write the entire object.
- No need for RedisJSON module (adds operational complexity).

## Decision: Fixed TTL vs Sliding Expiration

| Approach | Redis Command | Behavior |
|----------|---------------|----------|
| Fixed TTL | `SETEX` | Expires after N seconds from write |
| Sliding | `EXPIRE` on every read | Expires N seconds after last access |

We chose fixed TTL because:
- Weather data has a real-world refresh cadence (API-side updates).
- Sliding expiration would keep stale data alive indefinitely if the city is queried constantly.
- Fixed TTL guarantees maximum age, which is what users expect for weather.

## Decision: Fail-Stale vs Fail-Hard on API Error

| Approach | UX | Data Freshness | Risk |
|----------|-----|----------------|------|
| Fail-stale (serve old cache) | Good | Poor | User sees outdated severe weather warnings |
| Fail-hard (503) | Poor | N/A | User leaves the site |
| Fail-partial (serve cache + warning banner) | Good | Transparent | Requires frontend cooperation |

We chose fail-stale with a warning property. This balances availability and honesty. A news site might choose fail-hard for tornado alerts; a weather widget on a blog chooses fail-stale.

## Decision: No Distributed Lock on Refresh

**This is the intentional bug.** The correct implementation would use:

| Lock Strategy | Complexity | Accuracy | Overhead |
|---------------|------------|----------|----------|
| Redis Redlock | High | High | 2-3 RTTs |
| `SET key NX EX` | Low | Good | 1 RTT |
| Semaphore (ZooKeeper) | Very high | Very high | Heavy infra |

We omitted the lock to demonstrate the stampede. In production, use `SET weather:lock:<city> 1 NX EX 10`:
```ts
const lock = await redis.set(lockKey, '1', 'EX', 10, 'NX');
if (lock) {
  const data = await fetchWeatherFromApi(city);
  await setCachedWeather(city, data);
  await redis.del(lockKey);
} else {
  await sleep(100);
  return getCachedWeather(city); // retry for cache
}
```
