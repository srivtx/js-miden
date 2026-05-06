# S03 Weather Cache — Testing

## Test Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Jest/Vitest | Cache helpers, API client |
| Integration | Supertest | Full route with mocked Redis |
| Load | `autocannon` or `k6` | Stampede detection |

## Key Test Cases

### 1. Cache Hit
```ts
await redis.setex('weather:london', 3600, JSON.stringify(mockData));
const res = await request(app).get('/weather/london');
expect(res.body.source).toBe('cache');
```

### 2. Cache Miss → API → Cache Write
```ts
// Ensure Redis has no key
await redis.del('weather:paris');
const res = await request(app).get('/weather/paris');
expect(res.body.source).toBe('api');
const cached = await redis.get('weather:paris');
expect(cached).toBeTruthy();
```

### 3. Stale Cache Refresh
```ts
const stale = { ...mockData, fetchedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString() };
await redis.setex('weather:tokyo', 3600, JSON.stringify(stale));
const res = await request(app).get('/weather/tokyo');
expect(res.body.source).toBe('api'); // refreshed
```

### 4. Stale Fallback on API Failure
```ts
setNextRequestShouldFail(true);
const stale = { ...mockData, fetchedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() };
await redis.setex('weather:berlin', 3600, JSON.stringify(stale));
const res = await request(app).get('/weather/berlin');
expect(res.body.source).toBe('stale_cache');
expect(res.body.warning).toContain('outdated');
```

### 5. Cache Stampede Detection
```ts
await redis.del('weather:stampede');
const requests = Array(50).fill(request(app).get('/weather/stampede'));
const responses = await Promise.all(requests);
const apiCalls = responses.filter(r => r.body.source === 'api').length;
expect(apiCalls).toBeGreaterThan(1); // Demonstrates the bug
```

After applying the lock fix, this test should expect `apiCalls === 1`.

## Load Testing with k6

```js
import http from 'k6/http';
export const options = { vus: 100, duration: '30s' };
export default function () {
  http.get('http://localhost:3000/weather/london');
}
```

Expected results:
- **With fresh cache**: ~15,000 RPS, p95 < 10 ms
- **With stale cache and no lock**: ~50 RPS, p95 > 500 ms (API bottleneck)
- **With stale cache and lock**: ~200 RPS, p95 ~120 ms

## Why Test Stale-While-Revalidate

This path executes rarely (only when API is down and cache is old). It is the most important path for reliability and the most likely to break during refactors because developers rarely simulate API outages in local development.
