# v2 — Add TypeScript (Weather Cache)

## The Scenario

It's 2am. Your junior is debugging why the weather widget shows `temperature: undefined`. "The API returns `main.temp`, right?" they ask. You check the docs. The field is `main.temp_c` in the new version. JavaScript said nothing.

## The PAIN: API Schema Changes

From v1:

```javascript
app.get('/weather/:city', async (req, res) => {
  const data = await fetchWeather(city);
  res.json({
    city: data.name,
    temperature: data.main.temp,        // API changed to temp_c
    condition: data.weather[0].main,    // Might be undefined
    humidity: data.main.humidity,
  });
});
```

The external API added a field, renamed a field, or changed an array structure. Your code runs fine — it just returns `undefined` to clients. No crash. No error. Just broken data.

## The Solution: TypeScript Interfaces

```typescript
// types.ts
export interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  fetchedAt: string; // ISO timestamp
}

export interface WeatherApiResponse {
  // Map external API shape to our internal shape
  name: string;
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{ main: string }>;
  wind: { speed: number };
}
```

```typescript
// services/weatherApi.ts
import { WeatherData, WeatherApiResponse } from '../types.js';

export async function fetchWeatherFromApi(city: string): Promise<WeatherData> {
  const response = await fetch(`...`);
  const data: WeatherApiResponse = await response.json();
  
  // TypeScript enforces: if we forget a field, it complains
  const weather: WeatherData = {
    city: data.name,
    temperature: data.main.temp,
    condition: data.weather[0]?.main ?? 'Unknown',
    humidity: data.main.humidity,
    windSpeed: data.wind?.speed ?? 0,
    fetchedAt: new Date().toISOString(),
  };
  
  return weather;
}
```

### What TypeScript catches:

| Scenario | JavaScript | TypeScript |
|----------|-----------|------------|
| API returns `temp_c` instead of `temp` | Runtime `undefined` | **Compile error** if you update the interface |
| `data.weather[0]` is undefined | Runtime crash: Cannot read 'main' | **Compile warning**: Object is possibly 'undefined' |
| Forget `fetchedAt` field | Cache has no timestamp | **Compile error**: Property 'fetchedAt' is missing |
| Return wrong shape from cache | Client breaks | **Compile error**: Type mismatch |

## The New PAIN: Runtime Type Safety

```typescript
const cached = await redis.get(key);
if (cached) {
  return JSON.parse(cached) as WeatherData; // Trusting the cache
  // What if someone manually SET a malformed value?
}
```

TypeScript believes you. The cache might lie.

## The Realization

> Junior: "TypeScript caught that I forgot to include `fetchedAt` when I added Redis caching."
> 
> You: "Good. That field is critical — without it, we can't tell if cache is stale. But remember: the cache stores JSON. JSON has no types. Validate what comes out."

## Why this matters for Weather Cache

Our cache stores serialized `WeatherData`. When we retrieve it, we parse JSON and assert the type. But the cache might contain:
- Old schema versions (before we added `windSpeed`)
- Corrupted data
- Manually injected test data with wrong shapes

TypeScript can't validate runtime data. But it ensures *our code* handles the right shape consistently.

## Next: v3 — Add Validation
