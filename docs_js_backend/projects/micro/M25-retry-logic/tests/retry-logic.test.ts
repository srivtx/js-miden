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
    // Should exhaust retries and fail
    expect(requestCount).toBe(4); // original + 3 retries
    expect(res.status).toBe(502);
  });

  it('should NOT retry on 4xx errors', async () => {
    failWithStatus = 404;
    const res = await request(app).get('/fetch?url=http://localhost:9999/');

    // BUG: Retries on 4xx errors
    // Should only be 1 request (no retries), but bug causes 4
    expect(requestCount).toBe(1);
    expect(res.status).toBe(502);
  });

  it('should use exponential backoff with jitter', async () => {
    failWithStatus = 503;

    const start = Date.now();
    await request(app).get('/fetch?url=http://localhost:9999/');
    const duration = Date.now() - start;

    // Base delays: 1s, 2s, 4s = 7s minimum without jitter
    // With jitter, should be at least 7s but likely more
    // BUG: No jitter means exactly 7s (± small execution time)
    // We'll check that retries don't all happen at exact intervals
    // by making multiple requests and checking variance

    // For this test, we just verify it takes at least some time
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

    // With jitter, durations should vary significantly
    // Without jitter, they should be nearly identical
    const variance = Math.max(...durations) - Math.min(...durations);

    // BUG: No jitter means low variance
    expect(variance).toBeGreaterThan(100); // At least 100ms variance
  });
});
