# M05 Rate Limiter: The Incident

## 2:17 PM — The API Gateway Collapse

You are the SRE for a popular weather API. At 2:17 PM, your latency graph goes vertical. P95 spikes from 120ms to 18 seconds. Error rates climb from 0.01% to 34%.

Your CEO is demoing the API to a Fortune 500 prospect. The demo fails. The prospect leaves.

## The Symptom

```
GET /api/v1/forecast?city=London  200  18.4s
GET /api/v1/forecast?city=London  200  19.1s
GET /api/v1/forecast?city=London  504  Gateway Timeout
```

Every request is slow, then failing. But CPU is at 12%. Memory is fine. Database connections are exhausted.

## The Investigation

You check the database:

```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
--  active: 97
--  idle:    3
```

Your connection pool is maxed out. But why?

You check the logs. One IP address appears 847,000 times in the last 10 minutes:

```bash
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head
# 847293 203.0.113.45
```

## The Culprit

A data-scraping startup discovered your API last week. They are hammering `/forecast` with 1,400 requests per second from a single IP. Each request triggers:
1. Geocoding lookup (30ms)
2. Database query for cached forecast (5ms)
3. Third-party satellite data fetch (200ms, uncached)
4. JSON serialization (2ms)

One malicious client consumes 97 database connections and drowns legitimate users.

## The Rate Limiter That Wasn't

You check the codebase. There IS a rate limiter:

```javascript
const requests = new Map();

app.use((req, res, next) => {
  const ip = req.ip;
  const count = requests.get(ip) || 0;
  if (count > 100) {
    return res.status(429).send('Too many requests');
  }
  requests.set(ip, count + 1);
  next();
});
```

It is in-memory. You have 12 API servers behind a load balancer. The attacker rotates through all 12 servers. On each server, they stay under 100 requests. Total: 1,200 req/s allowed.

Worse: the `Map` grows forever. Memory leaks. The process OOMs every 6 hours.

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Move rate limiting to the edge** (nginx / Envoy / AWS WAF) for coarse defense:
   ```nginx
   limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
   limit_req zone=api burst=5 nodelay;
   ```

2. **Add Redis-backed sliding window rate limiting** in the application:
   ```javascript
   const key = `ratelimit:${ip}`;
   const now = Date.now();
   await redis.zremrangebyscore(key, 0, now - 60000);
   const count = await redis.zcard(key);
   if (count >= 10) {
     const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
     const retryAfter = Math.ceil((oldest[1] + 60000 - now) / 1000);
     return res.status(429).header('Retry-After', retryAfter).json({ error: 'Too many requests' });
   }
   await redis.zadd(key, now, `${now}-${Math.random()}`);
   await redis.pexpire(key, 60000);
   next();
   ```

3. **Return rate-limit headers** on every response so clients know their budget:
   ```
   X-RateLimit-Limit: 10
   X-RateLimit-Remaining: 3
   X-RateLimit-Reset: 1715110800
   ```

4. **Add per-endpoint cost**: `/forecast` costs 5 tokens, `/health` costs 0.

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why did the in-memory limiter fail? | Not shared across instances. Attacker distributed load across 12 servers. |
| Why did the database die first? | The forecast endpoint does uncached third-party fetches. Rate limiting should have been at the edge. |
| What monitoring gap existed? | No alert for "requests per IP." We watched aggregate RPS, not per-client RPS. |
| What architectural flaw? | Rate limiting was bolted on as middleware, not designed as a first-class infrastructure component. |

## The Real Lesson

> Rate limiting is not a feature. It is **load-bearing infrastructure**. Like fire doors in a building, you do not notice them until the fire starts. And if they are made of cardboard, people die.
