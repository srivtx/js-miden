# BUILD: Retry Logic

## Step-by-Step from Empty Folder

### Step 0: Create Project Directory

```bash
mkdir M25-retry-logic
cd M25-retry-logic
npm init -y
```

### Step 1: Install Dependencies

```bash
npm install express@^5.0.0
npm install -D typescript@^5.4.0 @types/node@^20.0.0 @types/express@^5.0.0 \
  jest@^29.7.0 @types/jest@^29.5.0 ts-jest@^29.1.0 supertest@^7.0.0 \
  @types/supertest@^6.0.0
```

### Step 2: Configure TypeScript

```json
// tsconfig.json
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
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 3: Configure Jest

```javascript
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testTimeout: 30000, // Longer timeout for retry tests
};
```

**Why 30s timeout:** Retry tests with exponential backoff can take 7+ seconds.

### Step 4: Create the Retry Client Core

```typescript
// src/retry-logic.ts

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

export class RetryClient {
  constructor(private options: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 10000,
  }) {}

  async fetch(url: string): Promise<{ status: number; data: string }> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        const data = await response.text();

        // BUG: Retries on 4xx errors (should only retry 5xx and timeouts)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${data}`);
        }

        return { status: response.status, data };
      } catch (error: any) {
        lastError = error;

        const isTimeout = error.name === 'AbortError';
        const is5xx = error.message?.includes('HTTP 5');
        const is4xx = error.message?.includes('HTTP 4');

        // BUG: No jitter - all retries happen at exact intervals
        if (attempt < this.options.maxRetries) {
          const delay = Math.min(
            this.options.baseDelayMs * Math.pow(2, attempt),
            this.options.maxDelayMs
          );
          // Should add jitter: delay + Math.random() * delay
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Key design choices explained:**
- `AbortController`: Properly cancels in-flight requests on timeout
- `clearTimeout(timeout)`: Prevents timer leaks when fetch succeeds
- `maxRetries`: Limits total attempts to `maxRetries + 1` (initial + retries)
- `lastError`: Preserves the actual error for the final throw

### Step 5: Create the Express Server

```typescript
// src/index.ts
import express from 'express';
import { RetryClient } from './retry-logic.js';

const app = express();
app.use(express.json());

const client = new RetryClient({
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  timeoutMs: 5000,
});

app.get('/fetch', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL query parameter required' });
    return;
  }

  try {
    const start = Date.now();
    const result = await client.fetch(url);
    const duration = Date.now() - start;

    res.json({
      url,
      status: result.status,
      data: result.data.slice(0, 1000),
      durationMs: duration,
    });
  } catch (error: any) {
    res.status(502).json({
      url,
      error: error.message,
      retriesExhausted: true,
    });
  }
});

export { app, client };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Retry logic service running on port ${PORT}`);
  });
}
```

**Route design explained:**
- `GET /fetch?url=...`: Proxies a URL fetch with retries
- Returns original status code, data, and duration
- 502 status indicates all retries were exhausted

### Step 6: Write Tests

```typescript
// tests/retry-logic.test.ts
import http from 'http';
import request from 'supertest';
import { app, client } from '../src/index.js';

describe('Retry Logic', () => {
  let mockServer: http.Server;
  let requestCount: number;
  let failWithStatus: number | null;
  let delayMs: number;

  beforeEach((done) => {
    requestCount = 0;
    failWithStatus = null;
    delayMs = 0;

    mockServer = http.createServer((req, res) => {
      requestCount++;

      if (delayMs > 0) {
        setTimeout(() => {
          if (failWithStatus) {
            res.writeHead(failWithStatus);
            res.end('error');
          } else {
            res.writeHead(200);
            res.end('success');
          }
        }, delayMs);
        return;
      }

      if (failWithStatus) {
        res.writeHead(failWithStatus);
        res.end('error');
      } else {
        res.writeHead(200);
        res.end('success');
      }
    });

    mockServer.listen(9999, done);
  });

  afterEach((done) => {
    mockServer.close(done);
  });

  it('should succeed on first try', async () => {
    failWithStatus = null;
    const res = await request(app).get('/fetch?url=http://localhost:9999/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(200);
  });

  it('should retry on 5xx errors', async () => {
    failWithStatus = 503;
    const res = await request(app).get('/fetch?url=http://localhost:9999/');
    expect(requestCount).toBe(4); // original + 3 retries
    expect(res.status).toBe(502);
  });

  it('should NOT retry on 4xx errors', async () => {
    failWithStatus = 404;
    const res = await request(app).get('/fetch?url=http://localhost:9999/');

    // BUG: Retries on 4xx errors
    expect(requestCount).toBe(1);
    expect(res.status).toBe(502);
  });

  it('should use exponential backoff with jitter', async () => {
    failWithStatus = 503;

    const start = Date.now();
    await request(app).get('/fetch?url=http://localhost:9999/');
    const duration = Date.now() - start;

    // Base delays: 1s, 2s, 4s = 7s minimum without jitter
    // With jitter, should be at least 7s but likely more
    expect(duration).toBeGreaterThanOrEqual(1000);
  });

  it('should retry on timeout', async () => {
    delayMs = 10000; // Longer than timeout
    const res = await request(app).get('/fetch?url=http://localhost:9999/');
    expect(requestCount).toBe(4);
    expect(res.status).toBe(502);
  });

  it('should have jitter in retry delays', async () => {
    failWithStatus = 503;

    const durations: number[] = [];
    for (let i = 0; i < 5; i++) {
      requestCount = 0;
      const start = Date.now();
      await request(app).get('/fetch?url=http://localhost:9999/');
      durations.push(Date.now() - start);
    }

    // With jitter, durations should vary significantly
    const variance = Math.max(...durations) - Math.min(...durations);

    // BUG: No jitter means low variance
    expect(variance).toBeGreaterThan(100);
  });
});
```

### Step 7: Run and Verify

```bash
npm run build
npm test
npm start
```

**Expected test results:** `should NOT retry on 4xx errors` and `should have jitter in retry delays` will fail due to intentional bugs.
