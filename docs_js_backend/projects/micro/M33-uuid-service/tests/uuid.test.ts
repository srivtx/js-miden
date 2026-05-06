import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { uuidV7 } from '../src/uuid.js';

describe('M33 UUID Service', () => {
  it('GET /uuid/v4 returns a valid v4 UUID', async () => {
    const res = await request(app).get('/uuid/v4');
    expect(res.status).toBe(200);
    expect(res.body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('GET /uuid/v7 returns a UUID-like string', async () => {
    const res = await request(app).get('/uuid/v7');
    expect(res.status).toBe(200);
    expect(res.body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('GET /uuid/ulid returns a ULID', async () => {
    const res = await request(app).get('/uuid/ulid');
    expect(res.status).toBe(200);
    expect(res.body.ulid).toMatch(/^[0-9A-Z]{26}$/);
  });

  it('POST /uuid/bulk returns requested count', async () => {
    const res = await request(app)
      .post('/uuid/bulk')
      .send({ count: 5, type: 'v4' });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(5);
    expect(res.body.type).toBe('v4');
  });

  // BUG REPRODUCTION
  it('BUG: UUID v7 timestamp precision is wrong (seconds not ms)', async () => {
    const before = Date.now();
    const uuid = uuidV7();
    const after = Date.now();

    // Extract timestamp from UUID v7 (first 48 bits = 12 hex chars)
    const timeHex = uuid.split('-')[0] + uuid.split('-')[1];
    const extractedTimestamp = parseInt(timeHex, 16);

    // The extracted timestamp should be close to Date.now() (within a few seconds)
    // But because the bug divides by 1000, it will be roughly Date.now() / 1000
    const diffMs = Math.abs(extractedTimestamp - before);
    const diffSeconds = Math.abs(extractedTimestamp - Math.floor(before / 1000));

    // If the bug is present, diffMs will be huge (around now - now/1000)
    // while diffSeconds will be small.
    expect(diffMs).toBeLessThan(5000); // This FAILS due to bug
    // After fix, the above passes because timestamp uses milliseconds.
    // Currently it fails because extractedTimestamp is in seconds.
  });
});
