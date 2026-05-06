# Step-by-Step Build Guide

## Step 1: Initialize the Project

```bash
mkdir M12-error-handler
cd M12-error-handler
npm init -y
```

Install dependencies:
```bash
npm install express
npm install -D typescript tsx @types/express @types/node vitest supertest @types/supertest
```

**Why these packages:**
- `express`: HTTP framework with error handling middleware support.
- `vitest` + `supertest`: Testing framework and HTTP assertion library.

### Common Mistakes at This Step
- **Mistake:** Installing Express 4 instead of Express 5.
  - **Why it breaks:** Express 4 does not catch unhandled promise rejections in async route handlers. Your async errors will crash the process.
  - **How to avoid:** Check `npm ls express` and ensure version 5.x is installed.

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
- **Mistake:** Forgetting `"module": "NodeNext"` with `"type": "module"`.
  - **Why it breaks:** TypeScript compiles to CommonJS by default, which conflicts with ES modules.
  - **How to avoid:** Always use `"module": "NodeNext"` for ES module Node.js projects.

---

## Step 3: Create the Error Class

Create `src/errors.ts`:
```typescript
export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public type: string = 'about:blank'
  ) {
    super(detail);
    this.name = 'AppError';
  }
}
```

**Why a custom error class:** Using `new Error('...')` for every error means you cannot distinguish between expected validation errors (400) and unexpected crashes (500). `AppError` carries `status` and `title`, so the error handler knows exactly how to format the response.

### Common Mistakes at This Step
- **Mistake:** Extending `Error` without calling `super()`.
  - **Why it breaks:** The error object will not have a message or stack trace.
  - **How to avoid:** Always call `super(message)` as the first line in the constructor.

---

## Step 4: Create Routes That Trigger Errors

Create `src/routes.ts`:
```typescript
import { Router } from 'express';
import { AppError } from './errors.js';

export const router = Router();

router.post('/divide', (req, res, next) => {
  const { a, b } = req.body as { a?: number; b?: number };
  if (typeof a !== 'number' || typeof b !== 'number') {
    next(new AppError(400, 'Bad Request', 'Both a and b must be numbers'));
    return;
  }
  if (b === 0) {
    next(new AppError(400, 'Bad Request', 'Division by zero is not allowed'));
    return;
  }
  res.json({ result: a / b });
});

router.get('/async-error', async (_req, _res, next) => {
  try {
    await Promise.reject(new Error('Database connection lost'));
  } catch (err) {
    next(err as Error);
  }
});

router.get('/headers-sent', (req, res, next) => {
  res.status(200).json({ ok: true });
  next(new Error('Cleanup failed after response'));
});
```

**Why these routes:**
- `/divide` demonstrates synchronous validation errors.
- `/async-error` demonstrates async error handling.
- `/headers-sent` demonstrates the double-response bug.

### Common Mistakes at This Step
- **Mistake:** Forgetting `return` after `next(err)`.
  - **Why it breaks:** Without `return`, the route continues executing. You might call `res.json()` after `next(err)`, causing `ERR_HTTP_HEADERS_SENT`.
  - **How to avoid:** Always `return next(err)` or use an `else` block.

---

## Step 5: Create the Error Handler (BUGGY VERSION)

Create `src/middleware/errorHandler.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // BUG 1: Does not check res.headersSent
  console.error('[Error]', err.message);

  const isAppError = err instanceof AppError;

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title: isAppError ? err.title : 'Internal Server Error',
    status: isAppError ? err.status : 500,
    detail: err.message,
    instance: req.originalUrl,
    // BUG 2: Always exposes stack trace
    stack: err.stack,
  };

  res.status(problem.status).json(problem);
}
```

### Common Mistakes at This Step
- **Mistake:** Registering the error handler before routes.
  - **Why it breaks:** Express matches middleware in order. If the error handler is first, it will never run.
  - **How to avoid:** Always register error handlers AFTER all routes and AFTER the 404 fallback.

---

## Step 6: Wire Everything Together

Create `src/app.ts`:
```typescript
import express from 'express';
import { router } from './routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use(router);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: 'The requested resource does not exist',
    instance: _req.originalUrl,
  });
});

// Global error handler - MUST be last
app.use(errorHandler);

export default app;
```

Create `src/index.ts`:
```typescript
import app from './app.js';
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`M12 Error Handler API running on http://localhost:${PORT}`);
});
```

### Common Mistakes at This Step
- **Mistake:** Putting the 404 handler before routes.
  - **Why it breaks:** Every request would hit the 404 handler first and never reach your routes.
  - **How to avoid:** 404 handlers MUST be after all valid routes but before the error handler.

---

## Step 7: Add Tests

Create `tests/error.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Error Handler', () => {
  it('should return 400 for invalid input', async () => {
    const res = await request(app).post('/divide').send({ a: 'foo', b: 2 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('type');
    expect(res.body).toHaveProperty('title', 'Bad Request');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('status', 404);
  });

  it('should return 500 for async errors', async () => {
    const res = await request(app).get('/async-error');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('title', 'Internal Server Error');
  });

  it('should NOT expose stack traces in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = await request(app).get('/async-error');
    process.env.NODE_ENV = originalEnv;
    expect(res.body).not.toHaveProperty('stack');
  });

  it('should handle errors gracefully after headers are sent', async () => {
    const res = await request(app).get('/headers-sent');
    expect(res.status).toBe(200);
  });
});
```

**Why these tests:** The first three verify normal behavior. The fourth is a security test — it asserts that `stack` is absent in production. The fifth is a stability test — it asserts that the server does not crash when headers are already sent.

### Common Mistakes at This Step
- **Mistake:** Mutating `process.env.NODE_ENV` without restoring it.
  - **Why it breaks:** Subsequent tests run in "production" mode and may behave differently.
  - **How to avoid:** Always save the original value and restore it in a `finally` block or after the assertion.

---

## Step 8: Fix the Bugs

Replace the error handler with the fixed version:
```typescript
export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    console.error('Error after headers sent:', err);
    return;
  }

  const isAppError = err instanceof AppError;
  const isDev = process.env.NODE_ENV !== 'production';

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title: isAppError ? err.title : 'Internal Server Error',
    status: isAppError ? err.status : 500,
    detail: err.message,
    instance: req.originalUrl,
    ...(isDev && { stack: err.stack }),
  };

  res.status(problem.status).json(problem);
}
```

Run tests again. All tests now pass.

**Why this fix works:**
1. `res.headersSent` prevents double-response crashes.
2. `isDev` ensures stack traces are only exposed in development.
3. The RFC 7807 format provides a consistent, extensible error shape.
