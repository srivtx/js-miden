import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M31 Request ID Middleware', () => {
  it('generates and attaches X-Request-ID on successful responses', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('reuses incoming X-Request-ID if present', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get('/health').set('X-Request-ID', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('logs include request ID', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).get('/health');
    expect(logSpy).toHaveBeenCalled();
    const logLine = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('requestId')
    );
    expect(logLine).toBeDefined();
    const entry = JSON.parse(logLine![0] as string);
    expect(entry.requestId).toBeDefined();
    logSpy.mockRestore();
  });

  // BUG REPRODUCTION
  it('BUG: error responses may lose X-Request-ID in catch blocks', async () => {
    // The /data route has an error path; force an error by monkey-patching Math.random
    const originalRandom = Math.random;
    Math.random = () => 0;

    const res = await request(app).get('/data');
    Math.random = originalRandom;

    // In the buggy implementation, the error handler does not explicitly ensure
    // X-Request-ID is present. It might be there from middleware, but if res was
    // not started yet, the header could be missing.
    expect(res.status).toBe(500);
    // This assertion documents the bug: the header SHOULD be present but may not be.
    // After fix, this should be: expect(res.headers['x-request-id']).toBeDefined();
    // Currently the bug is that it's NOT guaranteed in error flows.
    const hasRequestId = res.headers['x-request-id'] !== undefined;
    if (!hasRequestId) {
      console.log('BUG REPRODUCED: X-Request-ID missing on error response');
    }
    expect(hasRequestId).toBe(true); // This will fail until fixed
  });
});
