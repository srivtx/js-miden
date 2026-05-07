# M05 Rate Limiter: Three Wrongs

## Wrong #1: In-Memory Map

### The Code
```javascript
const requests = new Map();

app.use((req, res, next) => {
  const count = requests.get(req.ip) || 0;
  if (count > 100) {
    return res.status(429).send('Slow down');
  }
  requests.set(req.ip, count + 1);
  next();
});
```

### Why It Feels Right
- No network dependency. Zero latency overhead.
- Trivial to implement. Works on localhost.
- "I'll add Redis later when I scale."

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| Not shared across instances | 12 servers = 12x the effective limit |
| Memory leak | Map grows forever; OOM in hours |
| No TTL | A client who makes 1 request stays in Map forever |
| Lost on restart | All counters reset on deployment |

### The Realization
> "I have 12 API servers. My rate limiter allows 1,200 requests per minute. I thought it was 100."

---

## Wrong #2: Fixed Window Counter Without Boundary Tests

### The Code
```javascript
const window = Math.floor(Date.now() / 60000);
const key = `ratelimit:${ip}:${window}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);
if (count > 10) return res.status(429).send('Too many requests');
next();
```

### Why It Feels Right
- One Redis command (`INCR`) is atomic.
- Simple math. Easy to debug.
- Most requests are not at the boundary, so it looks correct.

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| Boundary burst | 10 requests at 01:59:59 + 10 at 02:00:00 = 20 in 1 second |
| No sliding window | An attacker can double their throughput by timing requests to the boundary |
| No `Retry-After` header | Clients do not know when to retry, causing thundering herd |

### The Realization
> "My rate limiter blocks 99.9% of abuse. The attacker just needs to find the 0.1% window at the minute boundary."

---

## Wrong #3: Fail Closed on Redis Failure

### The Code
```javascript
app.use(async (req, res, next) => {
  try {
    const count = await redis.incr(`ratelimit:${req.ip}`);
    if (count > 10) return res.status(429).send('Too many requests');
    next();
  } catch (err) {
    // Redis is down. Block everyone to be safe.
    return res.status(503).send('Service unavailable');
  }
});
```

### Why It Feels Right
- "If I cannot enforce the limit, I should deny all requests." 
- Security-first thinking. Better safe than sorry.
- Prevents abuse when monitoring is down.

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| Redis becomes a single point of failure | A Redis restart = total API outage |
| Denies legitimate users | The abuser switches IPs; your real users get 503s |
| Violates availability | Rate limiting should protect uptime, not destroy it |

### The Realization
> "I took down production because the rate limiter could not talk to Redis. The attacker was fine. My paying customers were not."

---

## The Pattern

All three wrongs share a common thread: **they optimize for simplicity or security in isolation, without considering the system as a whole.**

| Wrong | Optimized for | Sacrificed |
|-------|---------------|------------|
| In-memory Map | Speed | Correctness under scale |
| Fixed window | Simplicity | Accuracy at boundaries |
| Fail closed | Security | Availability |

> The best rate limiter is not the one with the simplest code. It is the one that **fails gracefully, scales horizontally, and gives clients the information they need to behave well.**
