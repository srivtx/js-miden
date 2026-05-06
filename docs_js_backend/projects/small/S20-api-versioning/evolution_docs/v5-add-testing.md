# S20 API Versioning — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the version router to "simplify" routing:

```ts
// BEFORE — correct
v1Router.get('/users', (req: Request, res: Response) => {
  const response = usersV2.map(transformV2toV1);
  response.forEach(validateV1Response);
  res.json(response);
});

// AFTER — "cleaner" but BROKEN
v1Router.get('/users', (req: Request, res: Response) => {
  // Oops, forgot the transform — v1 now returns v2 format directly
  res.json(usersV2);
});
```

Without tests, this ships. The v1 endpoint now returns `{ firstName, lastName }` instead of `{ name }`. Every v1 client breaks. It's a breaking change disguised as a refactor.

## The Fix: Comprehensive Versioning Tests

```ts
// tests/routes.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('API Versioning', () => {
  it('v2 should return split names', async () => {
    const res = await request(app).get('/v2/users');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body[0].firstName);
    assert.ok(res.body[0].lastName);
  });

  it('v1 should return { name } not { firstName, lastName }', async () => {
    const res = await request(app).get('/v1/users');
    assert.strictEqual(res.status, 200);
    
    const user = res.body[0];
    assert.ok(user.name, 'v1 should have name field');
    assert.strictEqual(user.firstName, undefined, 'v1 should NOT have firstName');
    assert.strictEqual(user.lastName, undefined, 'v1 should NOT have lastName');
  });

  it('should include deprecation notice in headers', async () => {
    const res = await request(app)
      .get('/v1/users')
      .set('Accept', 'application/vnd.api.v1+json');
    
    const deprecation = res.get('Deprecation');
    const sunset = res.get('Sunset');
    
    assert.ok(deprecation, 'Should include Deprecation header');
    assert.ok(sunset, 'Should include Sunset header');
  });
});
```

**What tests prevent:**
- Missing transform? **Caught** — v1 must not have `firstName` or `lastName`.
- Missing deprecation headers? **Caught** — `Deprecation` and `Sunset` must be present.
- Breaking v1 contract? **Caught** — `name` field must exist.

## The Pain That Remains

Your tests import from ESM files, but the project still has CJS vestiges. Modern Node.js is ESM-first. The test runner requires special flags because it's straddling both worlds.

## What v6 Fixes

Switch to ESM fully. CommonJS is legacy.
