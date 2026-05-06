# v5-add-testing.md — Request Logger

## The Pain

We added redaction (v3) and structured logging (v4), but a "quick fix" for debugging leaked passwords:

```typescript
// "Quick fix": log raw body during debugging
res.on('finish', () => {
  const entry = {
    method: req.method,
    path: req.path,
    body: process.env.DEBUG === 'true' ? req.body : redact(req.body),
  };
  logger.info(entry, 'Request completed');
});
```

A developer set `DEBUG=true` locally, committed the change, and forgot. It shipped to staging. Security audit found plaintext passwords in staging logs.

We also had no tests verifying redaction. The test suite passed because there were no assertions about log content.

## The Fix: Add Tests

```typescript
// tests/logger.test.ts
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
    expect(typeof logArg.duration).toBe('number');

    logSpy.mockRestore();
  });

  it('should NOT log sensitive fields like password', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).post('/login').send({ username: 'admin', password: 'secret' });

    const logArg = JSON.parse(logSpy.mock.calls[0][0] as string);

    // THIS ASSERTION FAILS DUE TO THE BUG:
    // The logger middleware serializes req.body directly into the log output
    expect(logArg.body).not.toHaveProperty('password');

    logSpy.mockRestore();
  });
});
```

## What Tests Caught

1. **Password leak:** The test sends a login request and asserts the log body doesn't contain `password`. If redaction is removed, the test fails.
2. **Log structure:** Every log must have `method`, `path`, `status`, `duration`.
3. **Request correlation:** `requestId` must be present and consistent.

## But Tests Don't Fix Debug Code

Tests catch regressions in redaction logic, but they don't prevent developers from adding `console.log(req.body)` for debugging. Code review + lint rules (`no-console`) are also needed.

> **Lesson:** Logger tests are security tests. A logger that leaks passwords is a data breach. Test your logs like you test your auth.
