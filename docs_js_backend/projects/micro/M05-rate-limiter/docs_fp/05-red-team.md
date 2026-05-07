# M05 Rate Limiter: Red Team

## Attack 1: The Boundary Burst

### Objective
Exploit the fixed window reset to send 2x the allowed traffic.

### Method
Send exactly 10 requests at 14:59:59.999, then 10 more at 15:00:00.000.

```bash
# Terminal 1: send 10 requests just before the boundary
for i in {1..10}; do curl https://api.example.com/data & done

# Terminal 2: send 10 requests immediately after the boundary
for i in {1..10}; do curl https://api.example.com/data & done
```

### Expected Result
20 requests accepted in under 1 second, despite a "10 per minute" limit.

### The Vulnerable Code
```javascript
const window = Math.floor(Date.now() / 60000);
const key = `ratelimit:${ip}:${window}`;
const count = await redis.incr(key);
if (count > 10) return res.status(429).send('Too many requests');
```

### Defense
Use a sliding window (Redis sorted sets) or token bucket. Ensure the limiter considers the previous window's traffic.

---

## Attack 2: The IP Rotation

### Objective
Bypass per-IP rate limits by cycling through thousands of IP addresses.

### Method
Use a residential proxy service with 50,000 rotating IPs. Each IP stays under the limit.

```python
import requests
from proxy_rotator import get_proxy

for i in range(100000):
    proxy = get_proxy()  # fresh IP every request
    requests.get('https://api.example.com/data', proxies=proxy)
```

### Expected Result
Effectively unlimited requests. The API sees 50,000 different "users," each well within their limit.

### Defense
- **Require API keys** tied to accounts, not IPs.
- **Fingerprint clients** using TLS signatures, header combinations, and behavioral patterns.
- **Detect anomalies:** 50,000 IPs with identical User-Agent and request timing is not organic traffic.

---

## Attack 3: The Distributed Slowloris

### Objective
Keep connections open just below the rate limit, exhausting server resources without ever triggering a 429.

### Method
Open 500 connections. Send one request every 59 seconds per connection.

```
Connection 1: req at 0s, 59s, 118s, ... (stays under 1/min)
Connection 2: req at 0s, 59s, 118s, ...
...
Connection 500: req at 0s, 59s, 118s, ...

Total: 500 req/min, but sustained for hours.
```

### Expected Result
Server threads, file descriptors, or database connections are consumed by idle connections.

### Defense
- **Connection timeouts:** Drop idle connections after 30 seconds.
- **Concurrent connection limits:** Max 10 connections per IP.
- **Cost-based limiting:** Charge by connection time, not just request count.

---

## Attack 4: The Header Spoof

### Objective
Trick the rate limiter into identifying you as a different client.

### Method
Manipulate `X-Forwarded-For` to inject fake IPs:

```bash
curl -H "X-Forwarded-For: 1.2.3.4, 5.6.7.8, 9.10.11.12" \
     https://api.example.com/data
```

If the app blindly uses the first IP in `X-Forwarded-For`, the attacker can choose any identity.

### The Vulnerable Code
```javascript
const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
```

### Defense
- Trust only the last hop added by your own load balancer.
- Use `req.socket.remoteAddress` for direct connections.
- Validate that the IP is a real IPv4/IPv6 address, not `lol-hacked`.

---

## Attack 5: The Retry Storm

### Objective
Amplify traffic by ignoring `Retry-After` and retrying immediately on 429.

### Method
```javascript
async function fetchWithRetry(url) {
  const res = await fetch(url);
  if (res.status === 429) {
    // Ignore Retry-After. Retry immediately.
    return fetchWithRetry(url);
  }
  return res;
}
```

One blocked request becomes 1000 requests per second.

### Defense
- **Exponential backoff with jitter** on the client (but you cannot control clients).
- **Penalize retries:** Each retry consumes 2 tokens instead of 1.
- **Temporary blacklist:** After 5 consecutive 429s, ban the IP for 1 hour.

---

## Attack 6: The Cost Asymmetry

### Objective
Find the most expensive endpoint and hammer it, knowing it costs you 1 token but costs the server 1000x more.

### Method
```bash
# /export generates a 500MB CSV. It costs 1 request token.
while true; do
  curl https://api.example.com/export
  sleep 6  # stay under 10/min limit
Done
```

### Expected Result
Server CPU, memory, and disk I/O are consumed by one well-behaved client staying perfectly within their rate limit.

### Defense
- **Endpoint-based costs:** `/export` costs 50 tokens. `/health` costs 0.
- **Resource quotas:** Max 1 export per hour per user.
- **Async processing:** Queue exports, return 202 Accepted, process offline.

---

## Red Team Mindset

> Rate limiting is an arms race. The attacker does not need to break your algorithm; they only need to find the gap between your assumptions and reality. Every simplification — "IP = user," "one request = one token," "fail closed is safer" — is a doorway.

Your job as a defender is to make abuse so expensive and so detectable that the attacker moves to an easier target. You will never stop a determined adversary with rate limiting alone. But you can stop the opportunists — and that is 99% of the threat.
