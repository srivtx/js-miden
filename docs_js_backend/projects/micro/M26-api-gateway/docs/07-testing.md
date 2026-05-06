# Testing: API Gateway Basics

## Running Tests

```bash
npm test
```

## Test Suite Overview

| Test | Description | Status |
|------|-------------|--------|
| `should proxy /users to user service` | Verifies routing to user backend | Pass |
| `should proxy /orders to order service` | Verifies routing to order backend | Pass |
| `should add X-Request-ID header` | Verifies request ID generation | Pass |
| `should log requests` | Verifies logging middleware | Pass |
| `should return 504 on backend timeout` | Verifies timeout handling | **FAIL** |
| `should return 502 on backend error` | Verifies error handling | **FAIL** |

## The Failing Tests

### Timeout Test

```typescript
it('should return 504 on backend timeout', async () => {
  // Start a backend that never responds
  const slowServer = createServer(() => {}); // hangs forever
  slowServer.listen(3001);

  const res = await request(app)
    .get('/users/slow')
    .timeout(1000); // test timeout

  expect(res.status).toBe(504);
  slowServer.close();
});
```

**Expected:** 504 Gateway Timeout within 1 second.
**Actual:** Request hangs indefinitely (test times out).

### Error Test

```typescript
it('should return 502 on backend error', async () => {
  // No server running on port 3001
  const res = await request(app).get('/users/profile');
  expect(res.status).toBe(502);
});
```

**Expected:** 502 Bad Gateway.
**Actual:** Gateway crashes with uncaught exception.

## Fixing the Tests

Add a 5000ms timeout to the proxy request and attach error handlers:

```typescript
proxyReq.setTimeout(5000, () => {
  proxyReq.destroy();
  res.status(504).json({ error: 'Gateway Timeout' });
});

proxyReq.on('error', (err) => {
  res.status(502).json({ error: 'Bad Gateway', message: err.message });
});
```
