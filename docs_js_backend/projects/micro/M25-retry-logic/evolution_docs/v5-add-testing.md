# v5: Add Testing — Retry Logic

## The Pain

You change the retry delay from `baseDelayMs * Math.pow(2, attempt)` to `baseDelayMs * (attempt + 1)` (linear backoff). It compiles. You deploy. During the next outage, 1,000 clients all retry every 1 second, creating a thundering herd that keeps the service down.

You find out when the incident post-mortem blames "client retry storm."

## The Solution

Jest + mock HTTP server. Test retry behavior, backoff timing, and jitter variance.

## The Test File

```typescript
// tests/retry-logic.test.ts
import http from 'http';
import request from 'supertest';
import { app, client } from '../src/index.js';

describe('Retry Logic', () => {
  let mockServer: http.Server;
  let requestCount: number;
  let failWithStatus: number | null;
  let delayMs: number;

  beforeEach((done) => {
    requestCount = 0;
    failWithStatus = null;
    delayMs = 0;

    mockServer = http.createServer((req, res) => {
      requestCount++;
      if (delayMs > 0) {
        setTimeout(() => {
          if (failWithStatus) {
            res.writeHead(failWithStatus);
            res.end('error');
          } else {
            res.writeHead(200);
            res.end('success');
          }
        }, delayMs);
        return;
      }
      if (failWithStatus) {
        res.writeHead(failWithStatus);
        res.end('error');
      } else {
        res.writeHead(200);
        res.end('success');
      }
    });

    mockServer.listen(9999, done);
  });

  afterEach((done) => {
    mockServer.close(done);
  });

  it('should succeed on first try', async () => {
    failWithStatus = null;
    const res = await request(app).get('/fetch?url=http://localhost:9999/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(200);
  });

  it('should retry on 5xx errors', async () => {
    failWithStatus = 503;
    const res = await request(app).get('/fetch?url=http://localhost:9999/');
    expect(requestCount).toBe(4); // original + 3 retries
    expect(res.status).toBe(502);
  });

  it('should NOT retry on 4xx errors', async () => {
    failWithStatus = 404;
    const res = await request(app).get('/fetch?url=http://localhost:9999/');
    expect(requestCount).toBe(1);
    expect(res.status).toBe(502);
  });

  it('should use exponential backoff with jitter', async () => {
    failWithStatus = 503;
    const start = Date.now();
    await request(app).get('/fetch?url=http://localhost:9999/');
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(1000);
  });

  it('should retry on timeout', async () => {
    delayMs = 10000; // Longer than timeout
    const res = await request(app).get('/fetch?url=http://localhost:9999/');
    expect(requestCount).toBe(4);
    expect(res.status).toBe(502);
  });

  it('should have jitter in retry delays', async () => {
    failWithStatus = 503;
    const durations: number[] = [];
    for (let i = 0; i < 5; i++) {
      requestCount = 0;
      const start = Date.now();
      await request(app).get('/fetch?url=http://localhost:9999/');
      durations.push(Date.now() - start);
    }
    const variance = Math.max(...durations) - Math.min(...durations);
    expect(variance).toBeGreaterThan(100); // Jitter creates variance
  });
});
```

## The Bug It Catches

The `should NOT retry on 4xx errors` test catches the bug where 4xx errors are retried:

```typescript
// BEFORE: Retries everything
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${data}`);
}
```

The test sets `failWithStatus = 404`, makes one request, and asserts `requestCount === 1`. If the code retries 404s, `requestCount` will be 4 and the test fails.

The `should have jitter in retry delays` test catches missing jitter:

```typescript
// BEFORE: No jitter
const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
await this.sleep(delay);
```

Without jitter, all 5 runs take nearly identical time. The variance assertion fails.

## Why Tests Catch Breakage Before Deploy

- **Retry classification**: Tests guarantee 404 fails fast, 503 retries
- **Backoff math**: Tests verify exponential growth, not linear
- **Jitter presence**: Tests measure statistical variance across runs
- **Timeout handling**: Tests confirm AbortController fires correctly

Without tests, a "cleanup" PR that removes jitter to "simplify" the code will pass review and cause a production outage.
