# v5: Add Testing — API Gateway

## The Pain

You refactor the proxy middleware to use `node-fetch` instead of native `http.request`. It compiles. You deploy. Now slow backends hang forever because `node-fetch` handles timeouts differently. The gateway leaks file descriptors until the kernel refuses connections.

You find out when `curl` to the gateway hangs for 5 minutes.

## The Solution

Jest + mock backend servers. Test timeout behavior, error handling, and request ID propagation.

## The Test File

```typescript
// tests/gateway.test.ts
import http from 'http';
import request from 'supertest';
import { app } from '../src/index.js';

describe('API Gateway', () => {
  let userServer: http.Server;
  let orderServer: http.Server;
  let userDelay: number;
  let userStatus: number;

  beforeEach((done) => {
    userDelay = 0;
    userStatus = 200;

    userServer = http.createServer((req, res) => {
      if (userDelay > 0) {
        setTimeout(() => {
          res.writeHead(userStatus);
          res.end(JSON.stringify({ service: 'user' }));
        }, userDelay);
        return;
      }
      res.writeHead(userStatus);
      res.end(JSON.stringify({ service: 'user' }));
    });

    orderServer = http.createServer((req, res) => {
      res.writeHead(200);
      res.end(JSON.stringify({ service: 'order' }));
    });

    userServer.listen(3001, () => {
      orderServer.listen(3002, done);
    });
  });

  afterEach((done) => {
    userServer.close(() => {
      orderServer.close(done);
    });
  });

  it('should proxy to user service', async () => {
    const res = await request(app).get('/users/profile');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('user');
  });

  it('should proxy to order service', async () => {
    const res = await request(app).get('/orders/123');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('order');
  });

  it('should attach X-Request-ID', async () => {
    const res = await request(app).get('/users/profile');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should return 504 on timeout', async () => {
    userDelay = 10000; // 10 seconds, longer than 5s timeout
    const res = await request(app).get('/users/profile');
    expect(res.status).toBe(504);
    expect(res.body.error).toBe('Gateway Timeout');
  });

  it('should return 502 on dead backend', async () => {
    await new Promise<void>(resolve => userServer.close(resolve));
    const res = await request(app).get('/users/profile');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Bad Gateway');
  });
});
```

## The Bug It Catches

The `should return 504 on timeout` test catches the missing timeout bug:

```typescript
// BEFORE: No timeout
const options = {
  hostname: url.hostname,
  port: url.port,
  path: req.path,
  method: req.method,
  headers: req.headers,
  // timeout: 5000, // MISSING!
};
```

The test makes the backend wait 10 seconds. Without a timeout, the test hangs (and Jest times out). With a timeout, the gateway returns 504 within 5 seconds.

## Why Tests Catch Breakage Before Deploy

- **Timeout enforcement**: Tests verify slow backends get 504, not infinity
- **Error propagation**: Tests confirm dead backends get 502, not crash
- **Routing accuracy**: Tests ensure `/users` goes to user service, not order service
- **Header contract**: Tests validate `X-Request-ID` is always present and UUID-shaped

Without tests, a refactor that accidentally removes `.on('timeout', ...)` will pass code review. With tests, `npm test` hangs for 30 seconds and fails — the bug is caught in CI, not production.
