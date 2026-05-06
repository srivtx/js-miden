# MD03: Caching Strategies for Sub-Millisecond Redirects

## The Redirect Hot Path

A URL redirect must be **fast**. Every millisecond of latency reduces click-through rates. The ideal path is:

```
User → CDN Edge → Cache Hit → 301 Redirect
```

No database query. No application server. Just a cached HTTP response.

## Cache Hierarchy

```
Layer 1: Browser Cache (client-side)
Layer 2: CDN Edge (Cloudflare, Fastly, AWS CloudFront)
Layer 3: In-Memory Cache (Redis)
Layer 4: Database (PostgreSQL)
```

### Layer 1: Browser Cache (301 vs 302)

HTTP status codes matter:
- **301 Moved Permanently**: Browser caches indefinitely. Subsequent clicks don't hit your server.
- **302 Found**: Browser does not cache. Every click hits your server.

For short URLs that never change, use **301**.
For URLs that might change (e.g., A/B testing), use **302**.

```javascript
// Permanent redirect (cached by browser)
res.redirect(301, longUrl);

// Temporary redirect (not cached)
res.redirect(302, longUrl);
```

### Layer 2: CDN Edge Caching

Configure your CDN to cache redirects:

```
Cache Rule: /:shortCode
  TTL: 1 hour (or longer)
  Key: shortCode
  Response: 301 to longUrl
```

**Problem**: If the long URL changes (e.g., correcting a typo), stale CDN caches serve the old URL.

**Solution**: Use short TTLs (1 hour) and purge on update:

```javascript
await cloudflare.cachePurge(['https://short.io/abc123']);
```

### Layer 3: Redis Cache

For cache misses at the CDN, the application server queries Redis before PostgreSQL:

```javascript
async function getLongUrl(shortCode) {
    // Try Redis first
    const cached = await redis.get(`url:${shortCode}`);
    if (cached) {
        return JSON.parse(cached);
    }

    // Fallback to database
    const result = await db.query(
        'SELECT long_url, expires_at FROM urls WHERE short_code = $1',
        [shortCode]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const urlData = result.rows[0];

    // Cache in Redis with TTL
    const ttl = urlData.expires_at
        ? Math.floor((new Date(urlData.expires_at) - Date.now()) / 1000)
        : 3600; // 1 hour default

    await redis.setex(`url:${shortCode}`, ttl, JSON.stringify(urlData));

    return urlData;
}
```

### Cache Warming and Invalidation

**Cache-Aside (Lazy Loading)**:
- Read from cache. Miss? Read from DB, write to cache.
- Simple, but first request after expiry is slow.

**Write-Through**:
- On URL creation, write to both DB and cache simultaneously.
- Ensures cache is always warm.

**Write-Behind**:
- Write to cache, async write to DB.
- Fastest, but risk of data loss.

For URL shorteners, **Write-Through** is recommended:

```javascript
async function createShortUrl(longUrl) {
    const code = generateCode();
    await db.query('INSERT INTO urls ...', [code, longUrl]);
    await redis.setex(`url:${code}`, 3600, JSON.stringify({ longUrl }));
    return code;
}
```

## Cache Stampede Prevention

When a popular URL's cache expires, thousands of concurrent requests may hit the database simultaneously:

```
T0: Cache expires for "viral-link"
T1: Request 1 → Cache miss → DB query
T2: Request 2 → Cache miss → DB query
T3: Request 3 → Cache miss → DB query
... (1000 requests hit DB simultaneously)
```

**Solutions**:

1. **Mutex Lock**: Only one request rebuilds the cache:

```javascript
const lock = await redis.set(`lock:url:${shortCode}`, '1', 'EX', 10, 'NX');
if (lock) {
    // Only this process queries DB and rebuilds cache
    const data = await db.query(...);
    await redis.setex(`url:${shortCode}`, 3600, JSON.stringify(data));
    await redis.del(`lock:url:${shortCode}`);
} else {
    // Wait briefly and retry cache
    await sleep(100);
    return redis.get(`url:${shortCode}`);
}
```

2. **Probabilistic Early Expiration**:

```javascript
// Rebuild cache before it expires, with probability increasing as expiry approaches
const ttl = await redis.ttl(`url:${shortCode}`);
if (ttl < 60 && Math.random() < 0.1) {
    // 10% chance of early rebuild in last 60 seconds
    rebuildCache(shortCode);
}
```

## CAP Theorem: Cache Consistency

Caches are inherently **eventually consistent**:
- A URL update in PostgreSQL does not immediately reflect in Redis or CDN.
- During the inconsistency window, users may see the old URL.

For URL shorteners, this is **acceptable** (AP choice). URLs rarely change.

If strong consistency is required (e.g., security takedown), use:
1. Cache invalidation on update
2. Short TTLs
3. Stale-while-revalidate headers

## Key Insight

> "A URL shortener is a read-heavy system where the read path must be optimized to the absolute limit. Caching is not an optimization; it is the architecture." — High Performance Browser Networking, Ilya Grigorik

Without caching, a URL shortener cannot scale. With proper CDN + Redis caching, 99%+ of redirects are served without touching the application server or database.
