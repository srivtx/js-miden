# M03: Build From Scratch

This guide walks through creating the health check project line by line. No copy-paste without understanding.

## Step 0: Prerequisites

- Node.js 20+
- Docker (for PostgreSQL and Redis)
- `npm` or `pnpm`

## Step 1: Project Scaffold

```bash
mkdir m03-health-check
cd m03-health-check
npm init -y
```

**Why `npm init -y`:** Creates `package.json` with defaults so we can install dependencies.

## Step 2: TypeScript Configuration

```bash
npm install -D typescript tsx @types/node @types/express @types/pg @types/supertest supertest vitest
npm install express pg ioredis
```

Create `tsconfig.json`:

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
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Why `module: "NodeNext"`:** Enables ES modules natively in Node.js. `import`/`export` instead of `require`/`module.exports`. This matches modern Node.js and allows top-level `await`.

Add to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

**Why `"type": "module"`:** Tells Node.js to treat all `.js` files as ES modules. Without this, `import` statements fail.

## Step 3: Docker Compose for Dependencies

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: healthcheck
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Why Docker Compose health checks:** The `healthcheck` blocks tell Docker to wait until PostgreSQL and Redis are actually ready before marking the containers as "healthy." This prevents race conditions where your app starts before the database is accepting connections.

**Why `pg_isready`:** PostgreSQL opens the TCP port before it is ready to accept queries. `pg_isready` actually attempts authentication, confirming the server is fully initialized.

Start dependencies:

```bash
docker-compose up -d
```

## Step 4: Database Connection with Pooling

Create `src/db.ts`:

```typescript
import { Pool } from 'pg';

export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'healthcheck',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  connectionTimeoutMillis: 5000,
});
```

**Line by line:**

- `import { Pool } from 'pg'` — We use `Pool`, not `Client`. `Pool` manages a set of reusable connections. `Client` creates a new connection every time.
- `host: process.env.DB_HOST || 'localhost'` — Environment variable override with local development default. Never hardcode production credentials.
- `connectionTimeoutMillis: 5000` — If no connection is available in the pool within 5 seconds, throw an error. This prevents requests from waiting forever.

**Why not `Client`?**

```typescript
// WRONG: Creates a new TCP connection for every query
const client = new Client({...});
await client.connect();
await client.query('SELECT 1');
await client.end();
```

At 100 requests per second, this creates 100 TCP connections per second. PostgreSQL default `max_connections = 100`. You will exhaust the database immediately.

## Step 5: Redis Connection

Create `src/redis.ts`:

```typescript
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  connectTimeout: 5000,
});
```

**Why `ioredis`:** The most robust Redis client for Node.js. Supports clustering, Sentinel, pub/sub, and has built-in reconnection logic.

**Why `connectTimeout: 5000`:** If Redis is unreachable, fail fast at 5 seconds instead of hanging indefinitely.

## Step 6: The Health Check Logic

Create `src/health.ts`:

```typescript
import { db } from './db.js';
import { redis } from './redis.js';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: string;
    redis: string;
  };
}

let cachedStatus: HealthStatus | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

export function clearHealthCache(): void {
  cachedStatus = null;
  cachedAt = 0;
}

export async function checkHealth(): Promise<HealthStatus> {
  const now = Date.now();

  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const checks = {
    database: 'ok',
    redis: 'ok',
  };

  // FIXED: Await the results so errors are captured before responding
  try {
    await db.query('SELECT 1');
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
  } catch {
    checks.redis = 'error';
  }

  const status: HealthStatus = {
    status: checks.database === 'ok' && checks.redis === 'ok' ? 'healthy' : 'unhealthy',
    checks,
  };

  cachedStatus = status;
  cachedAt = now;

  return status;
}
```

**Line by line:**

- `let cachedStatus: HealthStatus | null = null` — Module-level variable. Persists across requests. Node.js modules are singletons, so this is safe (no concurrency issues within a single process).
- `if (cachedStatus && now - cachedAt < CACHE_TTL_MS)` — Cache hit check. `Date.now()` is monotonic enough for this use case.
- `await db.query('SELECT 1')` — **The critical line.** `await` pauses execution until the database responds. Without it, execution continues immediately and the error handler never fires before the response is sent.
- `checks.database = 'error'` — Only runs if `db.query()` throws. The `.catch()` equivalent is `try/catch` with `await`.
- `status: checks.database === 'ok' && checks.redis === 'ok' ? 'healthy' : 'unhealthy'` — Boolean AND. Both must pass.

## Step 7: The Express Server

Create `src/index.ts`:

```typescript
import express from 'express';
import { checkHealth } from './health.js';

export const app = express();

app.get('/health', async (_req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (_error) {
    res.status(503).json({
      status: 'unhealthy',
      checks: {
        database: 'unknown',
        redis: 'unknown',
      },
    });
  }
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

**Line by line:**

- `export const app = express()` — Export the app instance so tests can mount it without starting a server on a port.
- `async (_req, res) =>` — The route handler is async so we can `await checkHealth()`.
- `const statusCode = health.status === 'healthy' ? 200 : 503` — HTTP semantics. `503` means "I am alive but cannot serve you."
- `if (process.env.NODE_ENV !== 'test')` — Prevents the server from binding to a port during tests. Tests use `supertest` which mounts the app directly.

## Step 8: Tests

Create `tests/health.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db.js';
import { redis } from '../src/redis.js';
import { clearHealthCache } from '../src/health.js';

describe('GET /health', () => {
  beforeEach(() => {
    clearHealthCache();
  });

  it('returns 200 when all services are healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('returns 503 when database is down', async () => {
    vi.spyOn(db, 'query').mockRejectedValue(new Error('DB connection failed'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('error');
    vi.restoreAllMocks();
  });
});
```

**Line by line:**

- `clearHealthCache()` — Each test starts with a fresh cache. Without this, the second test might get the cached result from the first test.
- `vi.spyOn(db, 'query').mockRejectedValue(...)` — Vitest utility. Replaces `db.query` with a function that always rejects. This simulates a database outage without stopping the Docker container.
- `request(app).get('/health')` — `supertest` mounts the Express app and makes an HTTP request internally. No actual network call.

## Step 9: Run It

```bash
# Start dependencies
docker-compose up -d

# Install dependencies
npm install

# Run the server
npm run dev

# In another terminal, test the endpoint
curl http://localhost:3000/health

# Run tests
npm test
```

## The Complete Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│                   (curl / LB / Browser)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ GET /health
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Route handler: /health                                │  │
│  │ 1. Call checkHealth()                                 │  │
│  │ 2. Return 200 or 503 with JSON body                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    HEALTH CHECK MODULE                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Check cache (5s TTL)                               │  │
│  │ 2. If miss:                                           │  │
│  │    a. await db.query('SELECT 1')                      │  │
│  │    b. await redis.ping()                              │  │
│  │ 3. Update cache                                       │  │
│  │ 4. Return status object                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
            ┌───────────┐           ┌───────────┐
            │   POOL    │           │  IOREDIS  │
            │  (pg)     │           │  CLIENT   │
            └─────┬─────┘           └─────┬─────┘
                  │                       │
                  ▼                       ▼
            ┌───────────┐           ┌───────────┐
            │PostgreSQL │           │   Redis   │
            │  :5432    │           │  :6379    │
            └───────────┘           └───────────┘
```
