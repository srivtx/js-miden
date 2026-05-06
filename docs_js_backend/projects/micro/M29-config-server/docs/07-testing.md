# Testing: Config Server

## Running Tests

```bash
npm test
```

## Test Suite Overview

| Test | Description | Status |
|------|-------------|--------|
| `should set and get config` | Verifies basic CRUD | Pass |
| `should merge config on update` | Verifies partial updates | Pass |
| `should isolate dev and prod configs` | Verifies environment separation | **FAIL** |
| `should reject invalid config values` | Verifies validation | **FAIL** |

## The Failing Tests

### Environment Isolation

```typescript
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
```

**Expected:** `dev` has `localhost`, `prod` has `prod.example.com`.
**Actual:** Both return the same value because `env` is ignored in storage.

### Validation

```typescript
it('should reject invalid config values', async () => {
  const res = await request(app)
    .post('/config/myapp/dev')
    .send({ port: -1 });

  expect(res.status).toBe(400);
});
```

**Expected:** 400 Bad Request.
**Actual:** 200 OK (invalid value accepted).

## Fixing the Tests

Store config by both app and environment:

```typescript
function setConfig(app: string, env: string, config: any) {
  if (!store[app]) store[app] = {};
  store[app][env] = { ...store[app][env], ...config };
}

function getConfig(app: string, env: string) {
  return store[app]?.[env] ?? {};
}
```
