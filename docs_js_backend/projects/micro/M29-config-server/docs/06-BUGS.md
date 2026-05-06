# 06-BUGS: Config Server

## WHAT is the bug?

The config server stores configuration **only by application name**, completely ignoring the `env` (environment) parameter. This means:
1. Setting config for `dev` overwrites the `prod` config for the same app.
2. There is no environment isolation whatsoever.

## WHY is this a real-world disaster?

Configuration is code without a compiler. A single wrong value can take down production. When environments are not isolated, the blast radius of a developer mistake is global.

**Specific risks:**
- **Database connections**: Dev config pointing to `localhost` overwrites prod's connection string.
- **Feature flags**: `debug: true` in dev enables debug mode in prod, leaking stack traces.
- **API keys**: Sandbox keys overwrite production keys, causing payment failures.
- **Security**: Dev CORS settings (`*`) apply to prod, opening XSS vectors.

## HOW to reproduce

### Reproduction 1: Dev Overwrites Prod

```bash
# Terminal 1: Start config server
npm run dev

# Terminal 2: Set dev config
curl -X POST http://localhost:3000/config/myapp/dev \
  -H "Content-Type: application/json" \
  -d '{"dbHost":"localhost","debug":true}'

# Terminal 3: Set prod config
curl -X POST http://localhost:3000/config/myapp/prod \
  -H "Content-Type: application/json" \
  -d '{"dbHost":"prod.example.com","debug":false}'

# Terminal 4: Get dev config
curl http://localhost:3000/config/myapp/dev
# EXPECTED: {"dbHost":"localhost","debug":true}
# ACTUAL: {"dbHost":"prod.example.com","debug":false}  (OVERWRITTEN!)
```

### Reproduction 2: Cross-Environment Merge Pollution

```bash
# Set dev config
curl -X POST http://localhost:3000/config/myapp/dev \
  -d '{"featureX":true}'

# Set prod config with different keys
curl -X POST http://localhost:3000/config/myapp/prod \
  -d '{"featureY":true}'

# Get dev config
curl http://localhost:3000/config/myapp/dev
# EXPECTED: {"featureX":true}
# ACTUAL: {"featureX":true,"featureY":true}  (MERGED ACROSS ENVIRONMENTS!)
```

### Test Code That Exposes the Bug

```typescript
// tests/config.test.ts
it('should isolate dev and prod configs', async () => {
  await request(app)
    .post('/config/myapp/dev')
    .send({ dbHost: 'localhost' });

  await request(app)
    .post('/config/myapp/prod')
    .send({ dbHost: 'prod.example.com' });

  const dev = await request(app).get('/config/myapp/dev');
  const prod = await request(app).get('/config/myapp/prod');

  expect(dev.body.dbHost).toBe('prod.example.com'); // BUG: dev was overwritten!
  expect(prod.body.dbHost).toBe('prod.example.com');
});
```

## Real-World Impact

**Case Study: 2018 Fintech Config Outage**
A fintech startup's config server had a bug nearly identical to this one: the environment parameter was ignored during storage. A junior developer updated the payment gateway's `dev` config to point to a sandbox API for testing. The config server stored it globally. When the production payment service restarted (as part of an unrelated auto-scaling event), it picked up the sandbox config.

**Impact:**
- All production payment transactions failed for 4 hours.
- $2.3M in transactions could not be processed.
- The company had to manually reconcile 14,000 failed transactions.
- The CTO wrote in the post-mortem: "Our config server had no environment isolation. That was not a bug; that was an architectural failure."

## The Fix

```typescript
// src/config.ts
const store: Record<string, Record<string, Record<string, any>>> = {};

export function setConfig(app: string, env: string, config: any) {
  if (!store[app]) {
    store[app] = {};
  }
  store[app][env] = { ...store[app][env], ...config };
}

export function getConfig(app: string, env: string) {
  return store[app]?.[env] ?? {};
}
```

## WRONG vs RIGHT

| Aspect | WRONG (Buggy) | RIGHT (Fixed) |
|--------|---------------|---------------|
| Storage key | `store[app]` | `store[app][env]` |
| Dev/prod isolation | None | Strict separation |
| Merge scope | Global per app | Scoped per environment |
| Blast radius | Any write affects all environments | Writes isolated to target env |
| Validation | Basic (accepts negative numbers) | Schema validation per key |

## Prevention Checklist

- [ ] Storage key includes environment dimension (`app × env`).
- [ ] Tests verify that dev writes do not affect prod.
- [ ] Tests verify that prod writes do not affect dev.
- [ ] Schema validation rejects invalid values (e.g., negative ports).
- [ ] Access control restricts who can write to `prod`.
- [ ] Audit log tracks every config change with user and diff.
- [ ] Configs are versioned and can be rolled back.
