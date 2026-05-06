# Testing: Bulkhead Pattern

## Running Tests

```bash
npm test
```

## Test Suite Overview

| Test | Description | Status |
|------|-------------|--------|
| `should allow requests within pool limit` | Verifies normal operation | Pass |
| `should reject when pool is full` | Verifies rejection at capacity | Pass |
| `should isolate critical from background` | Verifies pool independence | **FAIL** |
| `should not leak pool slots` | Verifies proper release | **FAIL** |

## The Failing Tests

### Pool Isolation

```typescript
it('should isolate critical from background', async () => {
  // Fill background pool to capacity
  const bgPromises = [
    request(app).get('/background'),
    request(app).get('/background'),
    request(app).get('/background'),
  ];

  // Immediately send a critical request
  const critical = await request(app).get('/critical');

  await Promise.all(bgPromises);

  expect(critical.status).toBe(200);
});
```

**Expected:** Critical request succeeds (200) because Pool A is separate.
**Actual:** Critical request is rejected (503) because both routes share one pool.

### Slot Leak

```typescript
it('should not leak pool slots', async () => {
  // Send requests that throw errors
  await request(app).get('/background?error=true');
  await request(app).get('/background?error=true');

  // Pool should still have capacity
  const res = await request(app).get('/background');
  expect(res.status).toBe(200);
});
```

**Expected:** 200 (slots were released even on error).
**Actual:** 503 (slots leaked because release was not in `finally`).

## Fixing the Tests

Create separate pools and ensure release in `finally`:

```typescript
const pools = {
  critical: new Pool('critical', 3),
  background: new Pool('background', 3),
};

function handle(poolName, req, res, handler) {
  const pool = pools[poolName];
  if (pool.hasCapacity()) {
    pool.acquire();
    handler(req, res).finally(() => pool.release());
  } else {
    res.status(503).send('Pool full');
  }
}
```
