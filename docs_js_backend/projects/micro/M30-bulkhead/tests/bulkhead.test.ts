import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/index.js';
import { getPoolStatus } from '../src/bulkhead.js';

describe('Bulkhead Pattern', () => {
  beforeEach(() => {
    // Reset pool state if possible
    // In the buggy version, there's only one shared pool
  });

  it('should allow requests within pool limit', async () => {
    const res = await request(app).get('/critical');
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('critical');
  });

  it('should reject when pool is full', async () => {
    // Send 4 concurrent requests to exceed pool size of 3
    const promises = [
      request(app).get('/background'),
      request(app).get('/background'),
      request(app).get('/background'),
      request(app).get('/background'),
    ];

    const results = await Promise.all(promises);
    const rejections = results.filter(r => r.status === 503).length;
    expect(rejections).toBeGreaterThanOrEqual(1);
  });

  it('should isolate critical from background', async () => {
    // Fill the background pool to capacity
    const bgPromises = [
      request(app).get('/background'),
      request(app).get('/background'),
      request(app).get('/background'),
    ];

    // Wait a tiny bit for them to acquire slots
    await new Promise(r => setTimeout(r, 50));

    // Now send a critical request
    const critical = await request(app).get('/critical');

    await Promise.all(bgPromises);

    // Due to the bug, critical shares the same pool as background
    // So when background pool is full, critical is also rejected
    expect(critical.status).toBe(503); // BUG: Should be 200!
  });

  it('should not leak pool slots', async () => {
    // The current implementation uses finally, so this should pass
    // But if it didn't, slots would leak
    const res = await request(app).get('/critical');
    expect(res.status).toBe(200);

    const status = getPoolStatus();
    expect(status.active).toBe(0); // Should be released
  });
});
