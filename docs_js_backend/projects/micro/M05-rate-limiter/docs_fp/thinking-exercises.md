# M05 Rate Limiter: Thinking Exercises

## Exercise 1: The Fixed Window Trap

You implement a fixed-window rate limiter:

```javascript
const window = Math.floor(Date.now() / 60000);
const key = `ratelimit:${ip}:${window}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);
if (count > 10) return res.status(429).send('Too many requests');
```

**Questions:**
1. A user sends 10 requests at 14:59:59. Then 10 at 15:00:00. How many requests were actually allowed in the 60-second window from 14:59:00 to 15:00:00?
2. Rewrite this as a true sliding window using Redis sorted sets.
3. What is the memory cost of the sliding window approach for 1 million active users?

---

## Exercise 2: The Fail-Open Dilemma

Your Redis instance restarts for maintenance. The rate limiter cannot connect.

**Option A:** Return 503 for all requests until Redis is back.
**Option B:** Allow all requests and log a warning.
**Option C:** Fall back to an in-memory Map with a 10-minute TTL.

**Questions:**
1. Who benefits from Option A? Who is harmed?
2. Design Option C. How do you prevent the in-memory fallback from becoming a memory leak?
3. Under what circumstances is Option B the right choice?

---

## Exercise 3: The Costly Endpoint

Your API has two endpoints:
- `GET /weather` — reads from cache, costs almost nothing.
- `POST /report` — generates a PDF, costs 10 seconds of CPU.

Both are limited to 10 requests per minute per user.

**Questions:**
1. An attacker discovers `/report` and sends 10 requests per minute. What is the impact?
2. Design a cost-based rate limiter where `/report` consumes 10 tokens and `/weather` consumes 1.
3. How would you implement this in Redis?

---

## Exercise 4: The Shared Office

Your API limits by IP: 10 requests per minute. A university campus has 5,000 students behind one NAT IP.

**Questions:**
1. How many legitimate students can use your API per minute?
2. Design a fallback strategy when a single IP exceeds the limit but has diverse User-Agents.
3. Is it ethical to block the entire university because of one abuser?

---

## Exercise 5: The Retry-After Math

A user hits the rate limit at 15:00:00. Their oldest request in the sliding window was at 14:59:10.

**Questions:**
1. What should the `Retry-After` header value be (in seconds)?
2. If the client ignores `Retry-After` and retries every second, how many 429 responses do they get before success?
3. Design a penalty system where repeated violations double the `Retry-After` value.

---

## Exercise 6: Distributed Token Bucket

Implement a token bucket rate limiter in Redis:
- Bucket capacity: 10 tokens.
- Refill rate: 1 token per second.
- Each request consumes 1 token.

**Questions:**
1. What Redis data structure and commands would you use?
2. How do you handle the "last check time" atomically?
3. Write the Lua script for `allowRequest(key, capacity, refillRate, now)`.

---

## Discussion Prompts

1. **Is rate limiting a user experience feature or a security feature?** Argue both sides.

2. **When is it acceptable to have no rate limiting?** Can you think of APIs that should not be limited?

3. **Redis is single-threaded. Does that make it a bottleneck or a guarantee?** How would you scale rate limiting to 10 million req/s?

4. **Your CEO wants to remove rate limiting because "it blocks customers."** Write the one-slide presentation that changes their mind.
