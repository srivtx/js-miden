# MD03 URL Shortener Pro — v7 Production Setup

Your URL shortener works. It has types, validation, logs, tests, and ESM. But at production scale, a shortener is a read-heavy system with unique security and performance challenges. One viral link can take down your cache.

## Pain #1: SQLite Dies at 10K Redirects/Second

You started with SQLite. Every redirect is a database read. At 10,000 redirects per second, SQLite's single writer lock becomes a bottleneck. Latency spikes from 2ms to 500ms. Users abandon clicks.

**Evolution: SQLite → PostgreSQL**

```prisma
// prisma/schema.prisma
model ShortUrl {
  code        String   @id
  longUrl     String
  ownerId     String?
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
  clickCount  Int      @default(0)
  clicks      ClickLog[]

  @@index([expiresAt])
  @@index([ownerId, createdAt])
}

model ClickLog {
  id        String   @id @default(uuid())
  code      String
  ipHash    String
  userAgent String?
  referrer  String?
  country   String?
  timestamp DateTime @default(now())

  shortUrl ShortUrl @relation(fields: [code], references: [code])

  @@index([code, timestamp])
  @@index([timestamp])
}
```

PostgreSQL handles concurrent reads. The `code` primary key gives O(log n) lookups.

**Evolution: Raw SQL → Prisma**

```ts
// Before
const row = await db.query('SELECT long_url FROM short_urls WHERE code = $1', [code]);

// After
const url = await prisma.shortUrl.findUnique({
  where: { code },
  include: {
    _count: { select: { clicks: true } },
  },
});
```

## Pain #2: Database Overload on Viral Links

A celebrity tweets your short link. 100,000 users click in one minute. Every click hits PostgreSQL. Your database CPU hits 100%. Other links slow down.

**Evolution: No Cache → Redis Cache**

```ts
// src/cache/redisCache.ts
import Redis from 'ioredis';

export class RedisCache {
  private redis = new Redis(process.env.REDIS_URL);
  private ttlSeconds = 3600; // 1 hour

  async getLongUrl(code: string): Promise<string | null> {
    return this.redis.get(`url:${code}`);
  }

  async setLongUrl(code: string, longUrl: string): Promise<void> {
    await this.redis.setex(`url:${code}`, this.ttlSeconds, longUrl);
  }

  async invalidate(code: string): Promise<void> {
    await this.redis.del(`url:${code}`);
  }
}
```

```ts
async function resolve(code: string): Promise<string | null> {
  // Check cache first
  const cached = await cache.getLongUrl(code);
  if (cached) {
    // Async analytics (don't block redirect)
    analyticsQueue.add({ code, cached: true });
    return cached;
  }

  // Cache miss: hit database
  const url = await prisma.shortUrl.findUnique({ where: { code } });
  if (!url) return null;

  if (url.expiresAt && url.expiresAt < new Date()) {
    return null;
  }

  // Populate cache
  await cache.setLongUrl(code, url.longUrl);

  analyticsQueue.add({ code, cached: false });
  return url.longUrl;
}
```

Redis handles 100K reads per second. Database load drops by 99%.

## Pain #3: Cache Stampede

The celebrity link's cache expires. 10,000 requests arrive simultaneously. All 10,000 miss cache. All 10,000 hit PostgreSQL. The database dies. This is a cache stampede.

**Evolution: Cache Stampede Protection**

```ts
// src/cache/stampedeProtectedCache.ts
import Redis from 'ioredis';

export class StampedeProtectedCache {
  private redis = new Redis(process.env.REDIS_URL);
  private ttlSeconds = 3600;
  private lockTtlMs = 5000;

  async getOrSet(
    code: string,
    factory: () => Promise<string | null>
  ): Promise<string | null> {
    const cacheKey = `url:${code}`;
    const lockKey = `lock:${code}`;

    // 1. Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    // 2. Try to acquire lock
    const lockId = crypto.randomUUID();
    const acquired = await this.redis.set(lockKey, lockId, 'PX', this.lockTtlMs, 'NX');

    if (acquired === 'OK') {
      // Winner: fetch from DB and populate cache
      try {
        const value = await factory();
        if (value) {
          await this.redis.setex(cacheKey, this.ttlSeconds, value);
        }
        return value;
      } finally {
        // Release lock (only if we still own it)
        const current = await this.redis.get(lockKey);
        if (current === lockId) {
          await this.redis.del(lockKey);
        }
      }
    }

    // 3. Loser: wait for winner to populate cache
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      const value = await this.redis.get(cacheKey);
      if (value) return value;
    }

    // Timeout: fall through to DB (degraded but not broken)
    return factory();
  }
}
```

Only one request fetches from the database. The rest wait. No stampede.

## Pain #4: Analytics Kill Performance

Every click writes a row to `click_logs`. At 100K clicks/minute, the table grows by 144M rows per day. Queries slow down. Disk fills up. Backups take forever.

**Evolution: Async Analytics Pipeline**

```ts
// Click events go to Redis Stream, not directly to DB
async function recordClick(code: string, metadata: ClickMetadata): Promise<void> {
  await redis.xadd('clicks:stream', '*',
    'code', code,
    'ipHash', hashIp(metadata.ip),
    'country', metadata.country || '',
    'timestamp', Date.now().toString()
  );
}

// Background worker batches inserts
async function flushAnalytics(): Promise<void> {
  const entries = await redis.xrange('clicks:stream', '-', '+', 'COUNT', 1000);
  if (entries.length === 0) return;

  const clicks = entries.map(([id, fields]) => ({
    code: fields[1],
    ipHash: fields[3],
    country: fields[5],
    timestamp: new Date(parseInt(fields[7])),
  }));

  await prisma.clickLog.createMany({ data: clicks });

  // Remove processed entries
  const lastId = entries[entries.length - 1][0];
  await redis.xtrim('clicks:stream', 'MINID', lastId);
}

// Run every 5 seconds
setInterval(flushAnalytics, 5000);
```

Analytics are batched. Database writes drop from 100K/minute to 12/minute.

## Pain #5: Architecture Spaghetti

Your route handler generates codes, checks rate limits, writes to the database, updates cache, logs analytics, and checks blocklists. It's 400 lines.

**Evolution: Monolith → Layered → Service-Based**

```
┌─────────────────┐
│   API Routes    │  ← HTTP, validation
├─────────────────┤
│ Shortener Service│ ← Business logic
├─────────────────┤
│  URL Repository │  ← PostgreSQL (Prisma)
│  Cache Layer    │  ← Redis
│  Analytics      │  ← Redis Stream → Worker
├─────────────────┤
│   Rate Limiter  │  ← Redis (sliding window)
│   Blocklist     │  ← Redis Set
└─────────────────┘
```

```ts
// src/services/urlShortenerService.ts
export class UrlShortenerService {
  constructor(
    private urlRepo: IUrlRepository,
    private cache: IStampedeProtectedCache,
    private rateLimiter: IRateLimiter,
    private blocklist: IBlocklist,
    private analytics: IAnalyticsPipeline,
  ) {}

  async shorten(req: ShortenRequest, ownerId?: string): Promise<ShortUrl> {
    await this.rateLimiter.checkLimit(ownerId);
    await this.blocklist.validateUrl(req.url);

    const code = req.customCode || await this.generateUniqueCode();
    const url = await this.urlRepo.create({ ...req, code, ownerId });

    return url;
  }

  async resolve(code: string, metadata: ClickMetadata): Promise<string | null> {
    const longUrl = await this.cache.getOrSet(code, () =>
      this.urlRepo.findLongUrl(code)
    );

    if (longUrl) {
      this.analytics.recordClick(code, metadata);
    }

    return longUrl;
  }
}
```

## Pain #6: Rate Limiting is Per-Process

You scale to 4 servers. A user gets rate-limited on Server 1. They retry and hit Server 2. Server 2 has no memory of the limit. They create 4× the allowed links.

**Evolution: In-Memory → Redis Sliding Window**

```ts
// src/rateLimit/redisRateLimiter.ts
import Redis from 'ioredis';

export class RedisRateLimiter {
  private redis = new Redis(process.env.REDIS_URL);

  async checkLimit(userId: string | undefined, ip: string): Promise<void> {
    const key = userId ? `rate:user:${userId}` : `rate:ip:${ip}`;
    const limit = userId ? 100 : 10; // per hour
    const windowSeconds = 3600;

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count recent entries
    const count = await this.redis.zcard(key);
    if (count >= limit) {
      throw new Error('Rate limit exceeded');
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${crypto.randomUUID()}`);
    await this.redis.expire(key, windowSeconds);
  }
}
```

Redis is shared across all servers. Rate limits are global and consistent.

## Final Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Gateway │────▶│   Express   │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
              ┌─────────────────────────────────┼─────────────────────────────────┐
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │ Shortener │                   │    Cache       │                 │ Analytics  │
        │  Service  │                   │  (Redis)       │                 │  Worker    │
        └─────┬─────┘                   └───────┬────────┘                 └──────┬─────┘
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │ PostgreSQL │                   │  Rate Limiter  │                 │ PostgreSQL │
        │ (URLs)     │                   │  (Redis)       │                 │ (Clicks)   │
        └────────────┘                   └────────────────┘                 └────────────┘
```

## Production Checklist

- [ ] PostgreSQL with Prisma migrations
- [ ] Redis cache with TTL for hot URLs
- [ ] Cache stampede protection (distributed locks)
- [ ] Async analytics pipeline (Redis Stream → batch insert)
- [ ] Redis sliding window rate limiter
- [ ] Domain blocklist with Redis Set
- [ ] Layered architecture (routes → services → repos)
- [ ] Connection pooling (PgBouncer)
- [ ] Redis Cluster for cache HA
- [ ] Analytics table partitioning (by month)

This is a production URL shortener. It started as a hash map. Now it handles 100K redirects per second with cache stampede protection, batched analytics, and global rate limiting.
