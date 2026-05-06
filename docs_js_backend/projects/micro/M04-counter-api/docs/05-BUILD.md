# M04: Build From Scratch

This guide walks through creating the counter API line by line.

## Step 0: Prerequisites

- Node.js 20+
- Docker (for Redis)

## Step 1: Project Scaffold

```bash
mkdir m04-counter-api
cd m04-counter-api
npm init -y
```

**Why `npm init -y`:** Creates `package.json` with defaults.

## Step 2: TypeScript Configuration

```bash
npm install -D typescript tsx @types/express @types/node
npm install express ioredis
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
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Why `module: "NodeNext"`:** Enables ES modules natively. `import`/`export` instead of CommonJS `require`/`module.exports`.

Add to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "test": "tsx --test tests/counter.test.ts",
    "load-test": "node load-test.js"
  }
}
```

## Step 3: Docker Compose for Redis

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: m04-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
```

**Line by line:**

- `image: redis:7-alpine` — Alpine Linux variant is ~30MB vs ~100MB for Debian. Smaller attack surface.
- `command: redis-server --appendonly yes` — Enables AOF persistence. Without this, Redis stores only in memory and loses data on restart.
- `volumes: redis-data:/data` — Mounts a Docker volume at `/data` so AOF files persist across container restarts.

**Why AOF?** The counter must survive server restarts. AOF logs every write command. On restart, Redis replays the log to restore state.

Start Redis:

```bash
docker-compose up -d
```

## Step 4: The Counter Logic

Create `src/counter.ts`:

### Version 1: The Bug (Read-Modify-Write)

```typescript
import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

/**
 * BUG: This implements a read-modify-write pattern which is NOT atomic.
 * Under concurrent requests, multiple clients read the same value,
 * increment it locally, and write back the same new value.
 * Result: lost increments.
 */
export async function increment(): Promise<number> {
  const current = await redis.get('counter');       // 1. READ
  const value = parseInt(current || '0', 10) + 1;   // 2. MODIFY
  await redis.set('counter', value.toString());     // 3. WRITE
  return value;
}

export async function getCount(): Promise<number> {
  const value = await redis.get('counter');
  return parseInt(value || '0', 10);
}
```

**Why this compiles and runs:** JavaScript has no compile-time concurrency checks. The code is syntactically valid and logically coherent for a single request. The failure mode is silent and only appears under load.

### Version 2: The Fix (Atomic INCR)

Replace the `increment` function with:

```typescript
export async function increment(): Promise<number> {
  return redis.incr('counter');  // Atomic: read + increment + write in one command
}
```

**Why this fixes it:** Redis executes `INCR` in its single-threaded event loop. No other command can interleave between the read and write. The operation is indivisible.

## Step 5: The Express Server

Create `src/index.ts`:

```typescript
import express from 'express';
import { increment, getCount } from './counter.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/increment', async (_req, res) => {
  try {
    const count = await increment();
    res.json({ count });
  } catch (_err) {
    res.status(503).json({ error: 'Redis unavailable' });
  }
});

app.get('/count', async (_req, res) => {
  try {
    const count = await getCount();
    res.json({ count });
  } catch (_err) {
    res.status(503).json({ error: 'Redis unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Counter API listening on port ${PORT}`);
});
```

**Line by line:**

- `import express from 'express'` — ESM import. Requires `"type": "module"` in package.json.
- `app.use(express.json())` — Parses JSON request bodies. Not strictly needed for GET/POST with no body, but standard practice.
- `try/catch` around every route handler — If Redis is down, `ioredis` throws. Without the catch, Express returns an unhandled error stack trace (security risk) and the client gets a generic 500.
- `res.status(503)` — Correct HTTP semantics. The service is temporarily unavailable, not broken.

## Step 6: Tests

Create `tests/counter.test.ts`:

```typescript
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Redis } from 'ioredis';
import { increment, getCount } from '../src/counter.js';

const redis = new Redis();

describe('Counter API', () => {
  beforeEach(async () => {
    await redis.del('counter');  // Reset counter before each test
  });

  test('increment returns sequential values', async () => {
    const v1 = await increment();
    const v2 = await increment();
    assert.strictEqual(v1, 1);
    assert.strictEqual(v2, 2);
  });

  test('getCount returns current value', async () => {
    await increment();
    await increment();
    const count = await getCount();
    assert.strictEqual(count, 2);
  });

  test('100 concurrent increments should equal 100', async () => {
    const promises = Array.from({ length: 100 }, () => increment());
    await Promise.all(promises);
    const count = await getCount();
    assert.strictEqual(count, 100);
  });
});
```

**Line by line:**

- `import { test, describe, beforeEach } from 'node:test'` — Node.js built-in test runner (available since Node 18). No external test framework needed.
- `await redis.del('counter')` — Ensures test isolation. Without this, tests interfere with each other.
- `Array.from({ length: 100 }, () => increment())` — Creates 100 promises simultaneously. They all start at the same time (within microseconds).
- `await Promise.all(promises)` — Waits for all 100 increments to complete.
- `assert.strictEqual(count, 100)` — With the bug, this assertion fails. The count is typically 40–80 instead of 100.

## Step 7: Load Test

Create `load-test.js`:

```javascript
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOTAL_REQUESTS = 1000;

async function getCount() {
  const res = await fetch(`${BASE_URL}/count`);
  if (!res.ok) throw new Error(`GET /count failed: ${res.status}`);
  return (await res.json()).count;
}

async function sendIncrement() {
  const res = await fetch(`${BASE_URL}/increment`, { method: 'POST' });
  if (!res.ok) throw new Error(`POST /increment failed: ${res.status}`);
  return res.json();
}

async function run() {
  const startCount = await getCount();
  console.log(`Starting count: ${startCount}`);
  console.log(`Firing ${TOTAL_REQUESTS} concurrent POST /increment requests...\n`);

  const promises = Array.from({ length: TOTAL_REQUESTS }, () => sendIncrement());
  await Promise.all(promises);

  const finalCount = await getCount();
  const expected = startCount + TOTAL_REQUESTS;
  const lost = expected - finalCount;

  console.log('Results:');
  console.log(`  Expected count:  ${expected}`);
  console.log(`  Actual count:    ${finalCount}`);
  console.log(`  Lost increments: ${lost}`);
  console.log(`  Race condition proven: ${lost > 0 ? 'YES' : 'NO'}`);
}

run().catch(console.error);
```

**How it works:**

1. Records the starting counter value.
2. Creates 1000 `fetch` promises simultaneously.
3. `Promise.all` waits for all to complete.
4. Reads the final counter value.
5. Compares expected (start + 1000) vs actual.

**Expected buggy output:**
```
Starting count: 0
Firing 1000 concurrent POST /increment requests...

Results:
  Expected count:  1000
  Actual count:    423
  Lost increments: 577
  Race condition proven: YES
```

**Expected fixed output:**
```
Starting count: 0
Firing 1000 concurrent POST /increment requests...

Results:
  Expected count:  1000
  Actual count:    1000
  Lost increments: 0
  Race condition proven: NO
```

## Step 8: Run It

```bash
# Start Redis
docker-compose up -d

# Install dependencies
npm install

# Run the server
npm run dev

# In another terminal, run tests
npm test

# Run load test (proves the bug)
redis-cli FLUSHDB  # reset counter
npm run load-test
```

## The Complete Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│              (curl / Browser / Load Test)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ GET /count  or  POST /increment
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Route handlers:                                       │  │
│  │ POST /increment → increment() → redis.incr()          │  │
│  │ GET /count      → getCount()  → redis.get()           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       IOREDIS CLIENT                         │
│              (maintains persistent TCP connection)           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ TCP on port 6379
┌─────────────────────────────────────────────────────────────┐
│                         REDIS                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Event Loop (single thread):                           │  │
│  │ 1. Dequeue INCR command                               │  │
│  │ 2. Atomically read + increment + write                │  │
│  │ 3. Respond with new value                             │  │
│  │                                                       │  │
│  │ Persistence: AOF log file                             │  │
│  │ appendonly.aof → replays on restart                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```
