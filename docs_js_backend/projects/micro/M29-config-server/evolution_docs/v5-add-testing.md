# M29 Config Server — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor `config.ts` to support versioning. In the process, you change the storage key:

```ts
// BEFORE
store[app][env] = config;

// AFTER — "cleaner" but WRONG
store[app] = { ...store[app], [env]: config };
```

Looks correct, right? But you also changed:

```ts
// BEFORE
export function getConfig(app: string, env: string) {
  return store[app]?.[env] ?? {};
}

// AFTER — oops, returns the whole app, not just the env
export function getConfig(app: string, _env: string) {
  return store[app] ?? {};
}
```

The `_env` prefix made the linter happy, but the function ignores the environment. Dev and prod are merged again.

You deploy on Friday. Monday morning: production outage. The payment service picked up dev config.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/config.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { getStore } from '../src/config.js';

describe('Config Server', () => {
  beforeEach(() => {
    const store = getStore();
    Object.keys(store).forEach(key => delete store[key]);
  });

  it('should isolate dev and prod configs', async () => {
    await request(app)
      .post('/config/myapp/dev')
      .send({ dbHost: 'localhost' });

    await request(app)
      .post('/config/myapp/prod')
      .send({ dbHost: 'prod.example.com' });

    const dev = await request(app).get('/config/myapp/dev');
    const prod = await request(app).get('/config/myapp/prod');

    expect(dev.body.dbHost).toBe('localhost');
    expect(prod.body.dbHost).toBe('prod.example.com');
  });

  it('should reject invalid config values', async () => {
    const res = await request(app)
      .post('/config/myapp/dev')
      .send({ port: null });

    expect(res.status).toBe(400);
  });
});
```

**What tests prevent:**
- The env isolation regression? Caught.
- The null value storage? Caught.
- Changing the status code from 400 to 200 on validation failure? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively. You're missing out on top-level await, tree shaking, and explicit dependency graphs.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
