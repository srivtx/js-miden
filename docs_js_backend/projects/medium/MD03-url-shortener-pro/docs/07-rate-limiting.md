# MD03: Rate Limiting and Abuse Prevention

## Why Rate Limiting is Essential

A URL shortener is an attractive attack target:
1. **Spam**: Bulk creation of links to phishing sites.
2. **DDoS**: Flood of requests to a single short code.
3. **Enumeration**: Sequential scanning of all short codes to discover links.
4. **Crypto-jacking**: Shortened URLs pointing to malicious scripts.

Rate limiting protects both the platform and its users.

## Rate Limiting Dimensions

| Dimension | Limit | Purpose |
|-----------|-------|---------|
| Shortening per IP | 10/minute | Prevent spam creation |
| Shortening per user | 100/hour | Prevent API abuse |
| Redirects per IP | 1000/minute | Prevent DDoS on short codes |
| Redirects per short code | 10,000/minute | Protect against targeted floods |

## Algorithm 1: Token Bucket

The token bucket allows bursts but enforces a long-term rate:

```
Bucket capacity: 10 tokens
Refill rate: 1 token/second

Request arrives:
  If tokens > 0: decrement token, allow request
  Else: reject with 429 Too Many Requests
```

### Redis Implementation

```javascript
const redis = require('redis');

async function tokenBucketCheck(key, capacity, refillRate) {
    const lua = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local requested = tonumber(ARGV[4])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or capacity
        local lastRefill = tonumber(bucket[2]) or now

        -- Calculate refilled tokens
        local elapsed = now - lastRefill
        local newTokens = math.min(capacity, tokens + elapsed * refillRate)

        if newTokens >= requested then
            newTokens = newTokens - requested
            redis.call('HMSET', key, 'tokens', newTokens, 'last_refill', now)
            redis.call('EXPIRE', key, 60)
            return 1
        else
            redis.call('HMSET', key, 'tokens', newTokens, 'last_refill', now)
            redis.call('EXPIRE', key, 60)
            return 0
        end
    `;

    const now = Date.now() / 1000;
    const result = await redis.eval(lua, 1, key, capacity, refillRate, now, 1);
    return result === 1;
}

// Usage
const allowed = await tokenBucketCheck(
    `rate_limit:shorten:${userIp}`,
    10,    // capacity
    1/60   // 1 per minute refill
);
if (!allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
}
```

## Algorithm 2: Fixed Window

Simpler but allows burst at window boundaries:

```javascript
async function fixedWindowCheck(key, limit, windowSeconds) {
    const current = await redis.incr(key);
    if (current === 1) {
        await redis.expire(key, windowSeconds);
    }
    return current <= limit;
}
```

## Algorithm 3: Sliding Window Log

Stores every request timestamp (memory-intensive but precise):

```javascript
async function slidingWindowLog(key, limit, windowSeconds) {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    const count = await redis.zcard(key);

    if (count < limit) {
        await redis.zadd(key, now, now);
        await redis.expire(key, windowSeconds);
        return true;
    }
    return false;
}
```

## Comparison

| Algorithm | Memory | Precision | Burst Handling |
|-----------|--------|-----------|----------------|
| Token Bucket | Low | Good | Excellent |
| Fixed Window | Low | Poor (edge bursts) | Poor |
| Sliding Window Log | High | Exact | Good |
| Sliding Window Counter | Medium | Approximate | Good |

**Recommendation**: Token Bucket for most use cases. Sliding Window Log for strict compliance.

## Distributed Rate Limiting

In a multi-node deployment, in-memory rate limiters are ineffective:

```
User A → Node 1 (5 requests) → Total: 5/10
User A → Node 2 (5 requests) → Total: 5/10 (node-local count)
Result: User made 10 requests but each node thinks 5. Limit bypassed!
```

**Solution**: Centralize state in Redis (as shown above) or use a shared datastore.

## CAP Theorem and Rate Limiting

Rate limiters are **tolerant of slight inaccuracy**:
- If Node 1 thinks a user has 2 tokens and Node 2 thinks they have 3, allowing 5 total instead of 3 is acceptable.
- Therefore, we can use **AP** semantics: Redis with `INCR` (not strictly linearizable) is sufficient.

For financial-grade rate limiting (e.g., API billing), use **CP**: Redis with `Redlock` or a consensus-based counter.

## Abuse Detection: Pattern Analysis

Beyond rate limits, detect behavioral patterns:

```sql
-- Find IPs creating many links to the same domain (spam)
SELECT creator_ip, long_url_domain, COUNT(*) as link_count
FROM urls
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY creator_ip, long_url_domain
HAVING COUNT(*) > 50;

-- Find short codes receiving abnormal traffic (DDoS target)
SELECT short_code, COUNT(*) as click_count
FROM click_events
WHERE timestamp > NOW() - INTERVAL '1 minute'
GROUP BY short_code
HAVING COUNT(*) > 10000;
```

Automated response:
1. Flag for review
2. Temporarily throttle the short code
3. Notify the link owner
4. Block the IP if confirmed malicious

## Key Insight

> "Rate limiting is not just about preventing abuse. It is about fairness — ensuring that one user's actions do not degrade the experience for everyone else." — Site Reliability Engineering, Google

A well-designed rate limiter is transparent to legitimate users and invisible until triggered. HTTP `429` responses should include a `Retry-After` header.

```javascript
res.status(429)
   .set('Retry-After', 60)
   .json({ error: 'Rate limit exceeded. Try again in 60 seconds.' });
```
