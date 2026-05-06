# v7-production-setup

## Goal
Run a scalable, analytics-rich URL shortener with rate limits, caching, and custom codes.

## Changes
1. **Random short codes** — `nanoid` (or `crypto.randomUUID` base62).
2. **Analytics** — Click counts, referrer breakdown, geo-IP (future), daily rollups.
3. **Custom codes** — Reserved for authenticated users; regex validated.
4. **Redis cache** — Cache `shortCode → url` to avoid Postgres on every redirect.
5. **Rate limiting** — `express-rate-limit` on `/shorten` (10/min) and redirect (100/min).
6. **Helmet** — Security headers.
7. **Graceful shutdown** — Drain requests, close pool and Redis.
8. **Structured logging** — `pino` shipped to stdout.

## Code

```ts
// src/services/shortener.ts
import { nanoid } from 'nanoid';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

export async function getUrlByShortCode(shortCode: string) {
  const cached = await redis.get(`url:${shortCode}`);
  if (cached) return JSON.parse(cached);

  const result = await pool.query('SELECT * FROM urls WHERE short_code = $1', [shortCode]);
  const row = result.rows[0] || null;
  if (row) await redis.setEx(`url:${shortCode}`, 3600, JSON.stringify(row));
  return row;
}
```

```ts
// src/services/analytics.ts
export async function getAnalyticsForCode(shortCode: string) {
  const clicks = await pool.query('SELECT COUNT(*) FROM clicks WHERE short_code = $1', [shortCode]);
  const referrers = await pool.query(
    'SELECT referrer, COUNT(*) as count FROM clicks WHERE short_code = $1 GROUP BY referrer',
    [shortCode]
  );
  return { shortCode, totalClicks: parseInt(clicks.rows[0].count, 10), referrers: referrers.rows };
}
```

```ts
// src/index.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

## Decisions
- **Redis read-through cache** — 1-hour TTL on URLs; invalidation on update (rare for shorteners).
- **Postgres for analytics** — Aggregations and time-series are relational strengths.
- **Rate limit on create** prevents abuse and spam shortening.

## Risks
- Redis cache stampede on a viral link. Use probabilistic early expiration or singleflight pattern.
- Custom codes can be squatting targets. Require auth and rate-limit per user.

## ASCII: Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Express    │────▶│   Redis     │
│             │     │  Rate Limit  │     │  URL Cache  │
└─────────────┘     └──────────────┘     └─────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │   Postgres   │
                       │ urls + clicks│
                       └──────────────┘
```
