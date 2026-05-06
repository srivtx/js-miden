# v5-add-testing.md — Error Handler

## The Pain

We added validation (v3) and logging (v4), but a "cleanup refactor" crashed production:

```typescript
// "Refactor": simplify error handler
export function errorHandler(err, req, res, next) {
  const problem = {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: err.message,
    instance: req.originalUrl,
    stack: err.stack,
  };
  res.status(problem.status).json(problem);
}
```

We removed the `res.headersSent` check because "it never triggered in dev." Then a streaming endpoint error occurred after headers were sent. The process crashed with:

```
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
```

All in-flight requests were dropped. Downtime: 15 minutes.

We also had a test that checked `expect(res.body).not.toHaveProperty('stack')` in production. It **always failed** because we kept shipping `stack` in production, but nobody ran the tests before deploy.

## The Fix: Add Tests (And Run Them)

```typescript
// tests/error.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Error Handler', () => {
  it('should return 400 for invalid input', async () => {
    const res = await request(app).post('/divide').send({ a: 'foo', b: 2 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('type');
    expect(res.body).toHaveProperty('title', 'Bad Request');
    expect(res.body).toHaveProperty('status', 400);
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

    // THIS ASSERTION FAILS DUE TO THE BUG:
    // The handler always includes `stack` in the response body
    expect(res.body).not.toHaveProperty('stack');
  });

  it('should handle errors gracefully after headers are sent', async () => {
    const res = await request(app).get('/headers-sent');
    expect(res.status).toBe(200);
    // Without res.headersSent check, this crashes the process
  });
});
```

## What Tests Caught

1. **Stack trace leak:** The test sets `NODE_ENV = 'production'` and asserts `stack` is absent. If someone adds `stack` back, the test fails.
2. **Double-response crash:** The `/headers-sent` route sends a response then triggers an error. Without `headersSent` check, the server crashes.
3. **Consistent shape:** All error responses must have `type`, `title`, `status`.

## But Tests Don't Fix Async Error Handling

Express 5 handles async rejections natively, but Express 4 requires wrappers. Tests verify behavior on the current version, but migrating Express versions requires additional testing.

> **Lesson:** Error handler tests are the most important tests in an API. A broken error handler turns minor bugs into production outages.
