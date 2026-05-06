# v1-simple-js.md — "I just want it to work"

## The 10-Minute Version

You build an API. It works. Why would you limit it?

```js
// server.js
const express = require('express');
const app = express();

app.get('/api/data', (req, res) => {
  res.json({ message: 'Here is your data' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**"This works. It's fast. Ship it."**

## The 3am Page

Your API is on Hacker News. Someone is benchmarking it with `ab -n 100000 -c 1000`. Your single Node.js process melts. Event loop lag hits 30 seconds. Legitimate users get 502 Gateway Timeout. Your hosting provider sends an abuse notice.

You check the logs. There are no logs. You don't even know which IP is doing it.

## The Bug You Can't See

Without rate limiting, a single malicious or careless client can exhaust your resources. But adding it wrong is almost as bad as not having it.

You try a quick in-memory fix:

```js
const requests = new Map();

app.get('/api/data', (req, res) => {
  const ip = req.ip;
  const count = (requests.get(ip) || 0) + 1;
  requests.set(ip, count);
  if (count > 100) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  res.json({ message: 'Here is your data' });
});
```

This has no time window. A user who made 99 requests yesterday is still rate-limited today. Also, the Map grows forever — every IP that ever visited stays in memory. You have a memory leak. Also, it doesn't work across server instances.

## What We Have

- **No rate limiting** — anyone can DDoS you accidentally
- **Naive Map counter** — no time window, unbounded memory leak
- **No distributed state** — per-server limits are bypassed by load balancers
- **No headers** — clients can't tell when they'll be allowed again

## What We Need

A real rate limiter with time windows. Redis for distributed state. And sliding windows so users don't get punished for bursts at the edge of a fixed minute.
