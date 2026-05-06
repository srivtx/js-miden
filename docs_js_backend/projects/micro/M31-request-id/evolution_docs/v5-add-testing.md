# M31 Request ID — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the error handler to include a stack trace:

```ts
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});
```

**The bug:** You removed the `X-Request-ID` header check. In the original middleware, `res.setHeader('X-Request-ID', requestId)` runs before the route. But if the error handler sends a fresh response without the header, the client never sees the request ID.

```ts
// BEFORE (correct)
app.use((err, req, res, next) => {
  if (!res.headersSent) {
    res.status(500).json({ error: err.message }); // inherits X-Request-ID
  }
});

// AFTER (buggy)
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message }); // might lose header
});
```

Users get 500s and can't report the request ID. Support is back to guessing.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/requestId.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M31 Request ID Middleware', () => {
  it('generates and attaches X-Request-ID on successful responses', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('reuses incoming X-Request-ID if present', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get('/health').set('X-Request-ID', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('logs include request ID', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).get('/health');
    const logLine = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('requestId')
    );
    expect(logLine).toBeDefined();
    const entry = JSON.parse(logLine![0] as string);
    expect(entry.requestId).toBeDefined();
    logSpy.mockRestore();
  });

  it('preserves X-Request-ID on error responses', async () => {
    const res = await request(app).get('/data');
    expect(res.status).toBe(500);
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
```

**What tests prevent:**
- The missing header on error responses? Caught.
- The UUID format regression? Caught.
- The incoming ID propagation bug? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively. You're missing out on top-level await and explicit dependency graphs.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
