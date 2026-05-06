# MD03: URL Shortener (Production)

A production-ready URL shortener with analytics, custom aliases, QR codes, rate limiting, and admin dashboard.

## Architecture

- **Express 5** with TypeScript (ESM)
- **Prisma ORM** with PostgreSQL
- **Redis** for caching and rate limiting
- **Base62** encoding for short codes
- **Batch analytics** writes for performance
- **Zod** for request validation

## Thinking Framework

### Phase 1: Core Features
1. URL shortening with auto-generated Base62 codes
2. Custom aliases
3. QR code generation (mock)
4. Click tracking (IP, referrer, country, device)
5. Rate limiting per IP
6. Admin dashboard with stats

### Phase 2: Robustness
- **Base62 Encoding**: Compact, URL-safe codes from auto-incrementing counter.
- **Collision Handling**: Custom aliases checked for uniqueness; auto-generated codes use atomic counter.
- **Cache Strategy**: Redis cache-aside for fast redirects.
- **Analytics Storage**: Batch writes via Redis list to prevent blocking redirects.
- **Rate Limiting**: Separate limits for shortening and redirecting.

### Phase 3: Bug Analysis
**Intentional Bug: Cache Stampede**

Located in `src/services/urlService.ts` in `getOriginalUrl()`.

When a popular short URL's cache expires, all concurrent requests simultaneously miss the cache and hit the database:

```typescript
// VULNERABLE CODE:
const cached = await redis.get(`url:${shortCode}`);
if (cached) return cached;

const url = await prisma.url.findUnique({ where: { shortCode } });
// 1000 requests could all reach this line simultaneously
await redis.setEx(`url:${shortCode}`, config.cacheTtlSeconds, url.originalUrl);
```

**Impact**: Database overload when a popular URL's cache expires (thundering herd problem).

**Fix Options**:

1. **Mutex/Lock**: Use Redis SET NX EX to allow only one request to populate the cache:
```typescript
const lock = await redis.set(`lock:${shortCode}`, '1', { NX: true, EX: 10 });
if (lock) {
  const url = await prisma.url.findUnique({ where: { shortCode } });
  await redis.setEx(`url:${shortCode}`, config.cacheTtlSeconds, url.originalUrl);
  await redis.del(`lock:${shortCode}`);
} else {
  // Wait and retry cache
  await new Promise(r => setTimeout(r, 100));
  return getOriginalUrl(shortCode);
}
```

2. **Stale-While-Revalidate**: Set a longer TTL and refresh cache in background before expiry.

3. **SingleFlight**: Use a library like `p-singleflight` or `node-singleflight` to deduplicate in-flight requests.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/urls` | Create short URL |
| GET | `/urls/my` | List user's URLs |
| DELETE | `/urls/:shortCode` | Deactivate URL |
| GET | `/:shortCode` | Redirect to original URL |
| GET | `/admin/stats` | Admin dashboard stats |
| GET | `/admin/analytics/:urlId` | URL analytics |
| POST | `/admin/flush` | Flush analytics batch |
| GET | `/health` | Health check |

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL and Redis
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Run tests
npm test

# Start development server
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://urlshortener:urlshortener123@localhost:5434/urlshortener
REDIS_URL=redis://localhost:6381
PORT=3000
RATE_LIMIT_SHORTEN_PER_MINUTE=10
RATE_LIMIT_REDIRECT_PER_MINUTE=100
```

## Testing the Bug

Use a load testing tool like `autocannon` or `ab` to hit a popular short URL. When its cache expires, observe the database query spike.

```bash
# Create a URL
curl -X POST http://localhost:3002/urls \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://example.com"}'

# Load test the redirect (run multiple times, observe DB queries when cache expires)
ab -n 10000 -c 100 http://localhost:3002/{shortCode}
```
