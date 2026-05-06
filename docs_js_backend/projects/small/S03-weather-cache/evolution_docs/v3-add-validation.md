# v3 — Add Validation (Weather Cache)

## The Scenario

It's 2am. Your junior added TypeScript. "The weather data has the right shape!" they say. Then a user requests `GET /weather/; DROP TABLE cities;` and your cache key becomes `weather:; drop table cities;`. Redis handles it, but your logs show an injection attempt. TypeScript didn't catch it — it's a string.

## The PAIN: Strings Are Dangerous

From v2:

```typescript
router.get('/weather/:city', async (req: Request, res: Response) => {
  const city = req.params.city; // Type: string. Value: anything.
  const cached = await getCachedWeather(city);
  // User sends: city = "../../../etc/passwd"
  // Cache key becomes: "weather:../../../etc/passwd"
});
```

TypeScript sees `string`. It doesn't see path traversal, null bytes, or 10,000-character strings that blow up your cache memory.

### Real attacks:

```
GET /weather/; DROP TABLE users;
GET /weather/<script>alert(1)</script>
GET /weather/aaaaaaaaaaaaaaaa... (10KB string)
```

All are valid strings. None are valid cities.

## The Solution: Input Validation

### City Parameter Validation

```typescript
import { z } from 'zod';

const citySchema = z.string()
  .min(1, 'City name is required')
  .max(100, 'City name too long')
  .regex(/^[a-zA-Z\s\-'.]+$/, 'Invalid characters in city name')
  .transform(c => c.toLowerCase().trim());

router.get('/weather/:city', async (req: Request, res: Response) => {
  const parseResult = citySchema.safeParse(req.params.city);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid city name', issues: parseResult.error.issues });
    return;
  }
  
  const city = parseResult.data; // Guaranteed clean
  const cached = await getCachedWeather(city);
  // ...
});
```

### Cache Key Safety

```typescript
// services/cache.ts
export function getCacheKey(city: string): string {
  // Already validated, but defense in depth:
  const sanitized = city.toLowerCase().trim().replace(/[^a-z0-9\s\-]/g, '');
  return `weather:${sanitized}`;
}
```

### What validation catches:

| Input | Before | After |
|-------|--------|-------|
| `city=; DROP TABLE` | Passed to cache/API | **Rejected**: Invalid characters |
| `city=<script>` | Passed through | **Rejected**: Invalid characters |
| `city=""` (empty) | Cache miss, API call with empty string | **Rejected**: City name is required |
| `city=a... (10KB)` | Memory pressure, slow cache | **Rejected**: City name too long |
| `city=  London  ` | Cache miss (space mismatch) | **Normalized**: `london` |

## The PAIN of Cache Poisoning

```typescript
// Without validation:
GET /weather/london -> caches good data
GET /weather/London -> cache miss (case sensitive)
GET /weather/ london -> cache miss (leading space)
GET /weather/london%20 -> cache miss (URL encoded)

// Result: 4 API calls for the same city
```

Validation + normalization ensures `London`, `london`, and ` LONDON ` all hit the same cache key.

## Validation Evolution in Weather Cache

| Version | Validation | Cache behavior |
|---------|-----------|---------------|
| v1 (JS) | None | Cache poisoning, duplicate keys, injection attempts |
| v2 (TS) | Type only | Still accepts garbage strings |
| v3 (Zod) | Shape + normalization | Clean keys, single cache entry per city |

## The Realization

> Junior: "Validation normalized 'London' and 'london' to the same cache key. Our API quota usage dropped by 30%."
> 
> You: "That's the hidden value of validation. It's not just security — it's correctness. Bad input creates bad cache keys, duplicate API calls, and inconsistent data."

## The Next PAIN

Validation keeps bad data out, but what happens when the external API is down? Your users get 500s. You have no idea why — because you're not logging anything.

## Next: v4 — Add Logging
