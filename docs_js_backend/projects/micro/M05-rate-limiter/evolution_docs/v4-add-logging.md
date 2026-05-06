# v4-add-logging.md — "Something broke but I can't see what"

## The Bug

Your rate limiter starts blocking legitimate users. You have no logs. You check Redis:

```
127.0.0.1:6379> KEYS ratelimit:*
1) "ratelimit:::1:1715122800000"
2) "ratelimit:::1:1715122860000"
```

The IP is empty (`::1` is IPv6 localhost, but `req.ip` is `undefined` in some proxy setups). Every request without an IP shares the same counter. One user's burst blocks everyone.

You have no log of which requests were blocked or why. You add `console.log`:

```ts
console.log(`IP: ${ip}, Count: ${current}, Allowed: ${current <= MAX_REQUESTS}`);
```

Now you have a wall of text. Two requests interleave. You can't grep for a specific user. You can't aggregate blocked requests by IP. You can't tell if the rate limiter is working or broken.

## The 3am Page, Redux

A user emails: "Your API blocked me after 2 requests." You check Redis. Their key shows `3`. The limit is `10`. You have no log of the actual request. Maybe they hit at the edge of a window. Maybe there was a race condition. Maybe `req.ip` was `undefined` and they shared a counter with a botnet.

Without structured logs, every rate limit incident is a he-said-she-said.

## Adding Pino Structured Logging

```bash
npm install pino
```

```ts
// src/index.ts
import { createLogger } from 'pino';

const app = express();
const logger = createLogger({
  name: 'rate-limiter',
  level: process.env.LOG_LEVEL || 'info',
});

app.use(express.json());

app.get('/api/data', rateLimiter, (_req, res) => {
  res.json({ message: 'Here is your data' });
});
```

```ts
// src/rate-limiter.ts
export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  // ...

  try {
    const current = await redis.incr(key);
    // ...

    if (current > MAX_REQUESTS) {
      logger.warn({
        ip,
        key,
        count: current,
        windowStart,
      }, 'rate limit exceeded');

      res.setHeader('Retry-After', String(Math.ceil(effectiveTtl / 1000)));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(effectiveTtl / 1000)} seconds.`,
      });
    }

    logger.trace({ ip, key, count: current }, 'request allowed');
    next();
  } catch (err) {
    logger.error({ err, ip }, 'rate limiter Redis error');
    next(); // fail open
  }
}
```

Now:

```json
{
  "level": 40,
  "time": 1715123456789,
  "name": "rate-limiter",
  "ip": "192.168.1.100",
  "key": "ratelimit:192.168.1.100:1715122800000",
  "count": 11,
  "windowStart": 1715122800000,
  "msg": "rate limit exceeded"
}
```

And for Redis failures:

```json
{
  "level": 50,
  "time": 1715123456790,
  "name": "rate-limiter",
  "ip": "192.168.1.100",
  "err": { "type": "Error", "message": "Connection timeout" },
  "msg": "rate limiter Redis error"
}
```

## Why Pino?

- **JSON** is parseable by SIEM tools and log aggregators
- **Log levels** let you set `LOG_LEVEL=warn` in production (trace in dev)
- **Structured fields** let you query by IP, count, or window
- **Error serialization** captures Redis connection failures

## Querying in Production

```bash
# Top 10 IPs hitting rate limits
docker logs api | jq -s '
  map(select(.msg == "rate limit exceeded"))
  | group_by(.ip) | map({ ip: .[0].ip, count: length })
  | sort_by(.count) | reverse | .[:10]
'

# Redis errors per hour
docker logs api | jq -s '
  map(select(.msg == "rate limiter Redis error"))
  | group_by(.time / 3600000 | floor)
  | map({ hour: .[0].time, count: length })
'
```

## What Changed

- Added Pino for structured logging
- Rate limit blocks are logged at `warn` level
- Redis errors are logged at `error` level
- IP and key are logged for every blocked request
- Fail-open behavior is logged so you know the limiter is down

## What We Still Need

Logging shows us abuse patterns after they happen. But when we change the window size or switch from fixed to sliding window, we might accidentally break the health endpoint or allow unlimited requests. We need to catch that before deploy.

For that, we need tests.
