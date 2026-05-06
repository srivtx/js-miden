# 05-BUILD.md — Rate Limiter (M05)

## Step-by-Step Build

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for Redis)
- npm or pnpm

---

### Step 1: Project Scaffold

```bash
mkdir M05-rate-limiter && cd M05-rate-limiter
npm init -y
npm install express ioredis
npm install -D typescript @types/express @types/node vitest supertest @types/supertest tsx
```

---

### Step 2: TypeScript Configuration

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

### Step 3: Redis via Docker

`docker-compose.yml`:
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```

```bash
docker compose up -d
```

---

### Step 4: The Rate Limiter Middleware

Create `src/rate-limiter.ts`:

```typescript
import { Redis } from 'ioredis';
import type { Request, Response, NextFunction } from 'express';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380', 10),
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

const WINDOW_SIZE_MS = 60 * 1000;
const MAX_REQUESTS = 10;

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // FIXED WINDOW (intentional bug for demonstration)
  const windowStart = Math.floor(now / WINDOW_SIZE_MS) * WINDOW_SIZE_MS;
  const key = `ratelimit:${ip}:${windowStart}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, WINDOW_SIZE_MS);
    }

    const ttl = await redis.pttl(key);
    const effectiveTtl = ttl > 0 ? ttl : WINDOW_SIZE_MS;
    const resetTime = now + effectiveTtl;

    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - current)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    if (current > MAX_REQUESTS) {
      res.setHeader('Retry-After', String(Math.ceil(effectiveTtl / 1000)));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(effectiveTtl / 1000)} seconds.`,
      });
    }

    next();
  } catch (err) {
    console.error('Rate limiter Redis error:', err);
    next(); // Fail open
  }
}
```

---

### Step 5: Express App

Create `src/index.ts`:

```typescript
import express from 'express';
import { rateLimiter } from './rate-limiter.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/data', rateLimiter, (_req, res) => {
  res.json({ message: 'Here is your data', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export { app };
```

---

### Step 6: Tests

Create `tests/rate-limiter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Redis } from 'ioredis';
import request from 'supertest';
import express from 'express';
import { rateLimiter } from '../src/rate-limiter.js';

const redis = new Redis({ host: 'localhost', port: 6380 });
const app = express();
app.get('/api/data', rateLimiter, (_req, res) => res.json({ success: true }));

describe('Rate Limiter', () => {
  beforeEach(async () => {
    const keys = await redis.keys('ratelimit:*');
    if (keys.length > 0) await redis.del(...keys);
  });

  afterAll(async () => await redis.quit());

  it('allows up to 10 requests per minute', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/api/data');
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-remaining']).toBe(String(9 - i));
    }
  });

  it('blocks the 11th request', async () => {
    for (let i = 0; i < 10; i++) await request(app).get('/api/data');
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
```

---

### Step 7: Run

```bash
npm run dev    # tsx src/index.ts
npm test       # vitest
```

---

### Step 8: The Fix (True Sliding Window)

Replace the `INCR` logic with a Lua script using sorted sets:

```lua
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count < limit then
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window)
    return {1, limit - count - 1}
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = math.ceil((oldest[2] + window - now) / 1000)
    return {0, retry_after}
end
```

Load and call it in `rate-limiter.ts`:

```typescript
const slidingWindowScript = `...lua above...`;
const sha = await redis.script('LOAD', slidingWindowScript);

const result = await redis.evalsha(
  sha,
  1, // num keys
  key,
  WINDOW_SIZE_MS,
  MAX_REQUESTS,
  now,
  crypto.randomUUID()
);
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Skip Redis, use `Map` | Use Redis for distributed state |
| No tests for boundary condition | Add `boundary-test.js` |
| `INCR` without atomic expiry check | Lua script for read-check-write atomicity |
| Fail closed on Redis error | Fail open with logging |

## SOURCES

- Redis docs, "Eval" and "Sorted Sets."
- Express.js middleware documentation.
