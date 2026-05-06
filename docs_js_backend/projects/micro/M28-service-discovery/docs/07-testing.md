# Testing: Service Discovery

## Running Tests

```bash
npm test
```

## Test Suite Overview

| Test | Description | Status |
|------|-------------|--------|
| `should register a service` | Verifies registration endpoint | Pass |
| `should discover registered services` | Verifies discovery endpoint | Pass |
| `should accept heartbeats` | Verifies heartbeat updates timestamp | Pass |
| `should remove stale services after TTL` | Verifies cleanup | **FAIL** |
| `should not return dead services in discovery` | Verifies filtering | **FAIL** |

## The Failing Tests

### Stale Cleanup

```typescript
it('should remove stale services after TTL', async () => {
  const res = await request(app)
    .post('/register')
    .send({ name: 'temp', url: 'http://localhost:9001' });

  const id = res.body.id;

  // Wait longer than TTL without heartbeating
  await new Promise(r => setTimeout(r, 3500));

  const discover = await request(app).get('/discover/temp');
  expect(discover.body).toEqual([]);
});
```

**Expected:** Empty array after TTL expires.
**Actual:** Service is still returned because no cleanup runs.

### Discovery Filtering

```typescript
it('should not return dead services in discovery', async () => {
  // Register but never heartbeat
  const res = await request(app)
    .post('/register')
    .send({ name: 'ghost', url: 'http://localhost:9001' });

  await new Promise(r => setTimeout(r, 3500));

  const discover = await request(app).get('/discover/ghost');
  expect(discover.body.length).toBe(0);
});
```

**Expected:** 0 services.
**Actual:** 1 service (the dead one).

## Fixing the Tests

Add a cleanup interval and TTL check:

```typescript
const TTL = 3000;

setInterval(() => {
  const now = Date.now();
  registry = registry.filter(s => now - s.lastHeartbeat <= TTL);
}, 1500);
```
