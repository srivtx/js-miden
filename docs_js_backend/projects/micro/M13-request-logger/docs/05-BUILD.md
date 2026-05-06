# Step-by-Step Build Guide

## Step 1: Initialize the Project

```bash
mkdir M13-request-logger
cd M13-request-logger
npm init -y
```

Install dependencies:
```bash
npm install express
npm install -D typescript tsx @types/express @types/node vitest supertest @types/supertest
```

**Why these packages:**
- `express`: HTTP framework.
- `vitest` + `supertest`: Testing framework and HTTP assertion library.

### Common Mistakes at This Step
- **Mistake:** Forgetting `@types/supertest`.
  - **Why it breaks:** TypeScript cannot resolve `supertest` types and compilation fails.
  - **How to avoid:** Always install matching `@types/` packages.

---

## Step 2: Configure TypeScript

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
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### Common Mistakes at This Step
- **Mistake:** Using `"module": "CommonJS"` with `"type": "module"`.
  - **Why it breaks:** Mismatched module systems cause runtime errors.
  - **How to avoid:** Use `"module": "NodeNext"` for ES module projects.

---

## Step 3: Create the Logger Middleware (BUGGY VERSION)

Create `src/middleware/logger.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // BUG: Logs the entire request body without redaction
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        body: req.body,
      })
    );
  });

  next();
}
```

**Why `res.on('finish')`:** This event fires after the response is fully sent. It guarantees the status code is available and does not block the response.

### Common Mistakes at This Step
- **Mistake:** Logging synchronously before calling `next()`.
  - **Why it breaks:** The status code is not known yet. Also, if the route throws, the log might not fire.
  - **How to avoid:** Always attach to `res.on('finish')` or `res.on('close')`.

---

## Step 4: Create Routes

Create `src/app.ts`:
```typescript
import express from 'express';
import { requestLogger } from './middleware/logger.js';

const app = express();

app.use(express.json());
app.use(requestLogger);

app.post('/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (username === 'admin' && password === 'secret') {
    res.json({ token: 'fake-jwt' });
    return;
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

Create `src/index.ts`:
```typescript
import app from './app.js';
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`M13 Request Logger running on http://localhost:${PORT}`);
});
```

### Common Mistakes at This Step
- **Mistake:** Registering `requestLogger` after routes.
  - **Why it breaks:** The logger would not run for those routes.
  - **How to avoid:** Register middleware before routes.

---

## Step 5: Add Tests

Create `tests/logger.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Request Logger', () => {
  it('should log request details for every request', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).get('/health');

    expect(logSpy).toHaveBeenCalledTimes(1);

    const logArg = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logArg).toHaveProperty('method', 'GET');
    expect(logArg).toHaveProperty('path', '/health');
    expect(logArg).toHaveProperty('status', 200);
    expect(logArg).toHaveProperty('duration');
    expect(typeof logArg.duration).toBe('number');

    logSpy.mockRestore();
  });

  it('should NOT log sensitive fields like password', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).post('/login').send({ username: 'admin', password: 'secret' });

    const logArg = JSON.parse(logSpy.mock.calls[0][0] as string);

    // This assertion FAILS due to the bug
    expect(logArg.body).not.toHaveProperty('password');

    logSpy.mockRestore();
  });
});
```

**Why these tests:** The first verifies normal logging behavior. The second is a security test — it asserts that passwords are not logged. This test will FAIL with the buggy implementation.

### Common Mistakes at This Step
- **Mistake:** Forgetting to call `logSpy.mockRestore()`.
  - **Why it breaks:** Subsequent tests might see stale mock calls or miss real console output.
  - **How to avoid:** Always restore mocks in a `finally` block or at the end of the test.

---

## Step 6: Fix the Bug

Replace the logger with the fixed version:
```typescript
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))
      ? '[REDACTED]'
      : redact(value);
  }
  return clone;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        body: redact(req.body),
      })
    );
  });

  next();
}
```

Run tests again. The security test now passes.

**Why this fix works:** The `redact()` function recursively traverses the request body. Any key that contains a sensitive substring (case-insensitive) is replaced with `[REDACTED]`. Nested objects are also scrubbed.

---

## Step 7: Production Upgrade (Optional)

For production, switch to `pino`:
```bash
npm install pino pino-pretty
```

```typescript
import pino from 'pino';

const logger = pino({
  level: 'info',
  redact: {
    paths: ['body.password', 'body.token', 'body.secret', 'headers.authorization'],
    censor: '[REDACTED]',
  },
}, pino.destination({ sync: false }));

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      userAgent: req.headers['user-agent'],
      body: req.body,
    });
  });

  next();
}
```

**Why pino:**
1. 5-10x faster than `console.log` under load.
2. Built-in redaction with path-based rules.
3. Async destination does not block the event loop.
4. Structured JSON output with log levels.
