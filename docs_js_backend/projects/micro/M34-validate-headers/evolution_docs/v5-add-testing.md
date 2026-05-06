# M34 Validate Headers — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You fix case-sensitivity by lowercasing rule names:

```ts
// BEFORE
const value = req.headers[rule.name];

// AFTER
const value = req.headers[rule.name.toLowerCase()];
```

But you also change the strict mode error handler:

```ts
// BEFORE
if (errors.length > 0 && mode === 'strict') {
  const err: any = new Error('Header validation failed');
  err.status = 400;
  err.details = errors;
  next(err);
}

// AFTER — "cleaner" but WRONG
if (errors.length > 0 && mode === 'strict') {
  return res.status(400).json({ error: 'Header validation failed' });
}
```

Now the error doesn't go through the error handler. The `details` field is lost. Clients only see `"Header validation failed"` with no specifics.

You deploy. API consumers complain about vague error messages. Support tickets pile up.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/validator.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M34 Validate Headers', () => {
  it('allows valid Content-Type in lenient mode', async () => {
    const res = await request(app)
      .get('/public')
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
  });

  it('warns but allows invalid Content-Type in lenient mode', async () => {
    const res = await request(app)
      .get('/public')
      .set('Content-Type', 'image/png');
    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeDefined();
  });

  it('rejects missing required header in strict mode', async () => {
    const res = await request(app).post('/private');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Header validation failed');
  });

  it('accepts valid custom token in strict mode', async () => {
    const res = await request(app)
      .post('/private')
      .set('Authorization', 'Bearer tokentokentoken')
      .set('X-Custom-Token', 'ABCDEF1234567890ABCDEF1234567890');
    expect(res.status).toBe(200);
  });

  it('recognizes lowercase header names', async () => {
    const res = await request(app)
      .get('/public')
      .set('content-type', 'application/json');
    expect(res.body.warnings).toBeUndefined();
  });
});
```

**What tests prevent:**
- The case-sensitivity regression? Caught.
- The missing details in strict mode? Caught.
- The valid token format change? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
