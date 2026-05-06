# BUILD: Circuit Breaker

## Step-by-Step from Empty Folder

### Step 0: Create Project Directory

```bash
mkdir M21-circuit-breaker
cd M21-circuit-breaker
npm init -y
```

### Step 1: Install Dependencies

```bash
npm install express@^5.0.0
npm install -D typescript@^5.4.0 @types/node@^20.0.0 @types/express@^5.0.0 \
  jest@^29.7.0 @types/jest@^29.5.0 ts-jest@^29.1.0 supertest@^7.0.0 \
  @types/supertest@^6.0.0
```

**Why each dependency:**
- `express`: HTTP server framework
- `typescript`: Type safety and compile-time checks
- `@types/*`: Type definitions for Node.js, Express, Jest, Supertest
- `jest`: Test runner
- `ts-jest`: Allows Jest to run TypeScript files directly
- `supertest`: HTTP assertion library for testing Express routes

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
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Why `module: "NodeNext"`:** Enables ES modules with Node.js resolution. Required for `import.meta.url` checks.

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
  testTimeout: 10000,
};
```

**Why ESM preset:** Our package.json uses `"type": "module"`. Jest must run in ESM mode to import our files.

### Step 4: Create the Circuit Breaker Core

```typescript
// src/circuit-breaker.ts

/**
 * CircuitState represents the three possible states of a circuit breaker.
 * 
 * 'closed'   - Normal operation, requests pass through
 * 'open'     - Failing fast, requests are rejected immediately
 * 'half-open'- Probing recovery with one test request
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold: number;   // Failures needed to open circuit
  failureWindowMs: number;    // Rolling window for failure counting
  halfOpenTimeoutMs: number;  // Time before attempting recovery
  timeoutMs: number;          // Max time per request
}

interface FailureRecord {
  timestamp: number;          // When the failure occurred
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: FailureRecord[] = [];
  private lastOpenTime: number = 0;
  private halfOpenAttempts: number = 0;

  constructor(
    private readonly options: CircuitBreakerOptions = {
      failureThreshold: 5,
      failureWindowMs: 60000,
      halfOpenTimeoutMs: 30000,
      timeoutMs: 5000,
    }
  ) {}

  getState(): CircuitState {
    this.checkTransition();
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkTransition();

    if (this.state === 'open') {
      const error = new Error('Circuit breaker is OPEN');
      (error as any).statusCode = 503;
      throw error;
    }

    if (this.state === 'half-open' && this.halfOpenAttempts >= 1) {
      const error = new Error('Circuit breaker is OPEN');
      (error as any).statusCode = 503;
      throw error;
    }

    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.options.timeoutMs);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  private checkTransition(): void {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastOpenTime;
      if (elapsed >= this.options.halfOpenTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
      }
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = [];
      this.halfOpenAttempts = 0;
    }
  }

  private onFailure(): void {
    this.failures.push({ timestamp: Date.now() });
    this.cleanupOldFailures();

    // BUG: Missing threshold check - see 06-BUGS.md
  }

  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.options.failureWindowMs;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  getMetrics() {
    return {
      state: this.state,
      failuresInWindow: this.failures.length,
      failureThreshold: this.options.failureThreshold,
    };
  }
}
```

**Key design choices explained:**
- `execute<T>(fn)`: Generic wrapper so the breaker works with any async function
- `executeWithTimeout`: Manual Promise with cleanup instead of Promise.race to avoid unhandled rejections
- `checkTransition()`: Called on every `getState()` and `execute()` to ensure timely state transitions
- `halfOpenAttempts`: Counter ensures only 1 probe request in half-open state

### Step 5: Create the Express Server

```typescript
// src/index.ts
import express from 'express';
import { CircuitBreaker } from './circuit-breaker.js';

const app = express();
app.use(express.json());

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  failureWindowMs: 60000,
  halfOpenTimeoutMs: 30000,
  timeoutMs: 5000,
});

// Simulated external API
let shouldFail = false;

app.post('/simulate/fail', (req, res) => {
  shouldFail = req.body.fail ?? true;
  res.json({ shouldFail });
});

app.get('/api/external', async (req, res) => {
  try {
    const result = await breaker.execute(async () => {
      if (shouldFail) {
        throw new Error('External API error');
      }
      return { data: 'success', timestamp: Date.now() };
    });
    res.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, circuitState: breaker.getState() });
  }
});

app.get('/health', (req, res) => {
  res.json({ state: breaker.getState(), metrics: breaker.getMetrics() });
});

export { app, breaker };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Circuit breaker service running on port ${PORT}`);
  });
}
```

**Route design explained:**
- `POST /simulate/fail`: Test control endpoint to trigger failures
- `GET /api/external`: Protected endpoint using the breaker
- `GET /health`: Observability endpoint showing state and metrics

### Step 6: Write Tests

```typescript
// tests/circuit-breaker.test.ts
import request from 'supertest';
import { app, breaker } from '../src/index.js';

describe('Circuit Breaker', () => {
  beforeEach(async () => {
    await request(app).post('/simulate/fail').send({ fail: true });
    (breaker as any).state = 'closed';
    (breaker as any).failures = [];
    (breaker as any).lastOpenTime = 0;
    (breaker as any).halfOpenAttempts = 0;
  });

  afterEach(async () => {
    await request(app).post('/simulate/fail').send({ fail: false });
  });

  it('should return success when external API works', async () => {
    await request(app).post('/simulate/fail').send({ fail: false });
    const res = await request(app).get('/api/external');
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('success');
  });

  it('should open circuit after 5 failures in 60s', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }
    const res = await request(app).get('/api/external');
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('OPEN');
  });

  it('should track failure count in metrics', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/external');
    }
    const health = await request(app).get('/health');
    expect(health.body.metrics.failuresInWindow).toBe(3);
  });

  it('should transition to half-open after timeout', async () => {
    const originalTimeout = (breaker as any).options.halfOpenTimeoutMs;
    (breaker as any).options.halfOpenTimeoutMs = 100;

    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }

    await new Promise(r => setTimeout(r, 150));
    const health = await request(app).get('/health');
    expect(health.body.state).toBe('half-open');

    (breaker as any).options.halfOpenTimeoutMs = originalTimeout;
  });

  it('should close circuit after successful half-open request', async () => {
    const originalTimeout = (breaker as any).options.halfOpenTimeoutMs;
    (breaker as any).options.halfOpenTimeoutMs = 100;

    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }

    await new Promise(r => setTimeout(r, 150));
    await request(app).post('/simulate/fail').send({ fail: false });

    const res = await request(app).get('/api/external');
    expect(res.status).toBe(200);

    const health = await request(app).get('/health');
    expect(health.body.state).toBe('closed');

    (breaker as any).options.halfOpenTimeoutMs = originalTimeout;
  });
});
```

### Step 7: Run and Verify

```bash
npm run build
npm test
npm start
```

**Expected test results:** One test (`should open circuit after 5 failures`) will fail due to the intentional bug. All others pass.
