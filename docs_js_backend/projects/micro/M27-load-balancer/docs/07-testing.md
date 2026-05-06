# Testing: Load Balancer

## Running Tests

```bash
npm test
```

## Test Suite Overview

| Test | Description | Status |
|------|-------------|--------|
| `should distribute requests round-robin` | Verifies sequential distribution | Pass |
| `should return 200 from healthy backends` | Verifies successful proxying | Pass |
| `should skip unhealthy backends` | Verifies health-based filtering | **FAIL** |
| `should return 503 when all backends are down` | Verifies graceful degradation | **FAIL** |

## The Failing Tests

### Skip Unhealthy Backends

```typescript
it('should skip unhealthy backends', async () => {
  // Backend 2 is stopped
  backend2.close();

  // Send 3 requests
  const responses = await Promise.all([
    request(app).get('/'),
    request(app).get('/'),
    request(app).get('/'),
  ]);

  // All should succeed because B2 is skipped
  expect(responses.every(r => r.status === 200)).toBe(true);
});
```

**Expected:** All requests succeed by routing to B1 and B3 only.
**Actual:** Some requests fail with connection refused because B2 is still selected.

### All Backends Down

```typescript
it('should return 503 when all backends are down', async () => {
  backend1.close();
  backend2.close();
  backend3.close();

  const res = await request(app).get('/');
  expect(res.status).toBe(503);
});
```

**Expected:** 503 Service Unavailable.
**Actual:** 502 or crash because the balancer tries to connect to dead servers.

## Fixing the Tests

Implement health checks and filter backends before selection:

```typescript
function selectBackend() {
  const healthy = backends.filter(b => b.healthy);
  if (healthy.length === 0) return null;
  return healthy[counter++ % healthy.length];
}

setInterval(() => {
  backends.forEach(b => checkHealth(b));
}, 5000);
```
