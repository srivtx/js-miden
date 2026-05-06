import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { convertTime } from '../src/timezone.js';

describe('M35 Timezone API', () => {
  it('converts UTC to Asia/Tokyo', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'UTC', to: 'Asia/Tokyo', time: '2024-01-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.convertedTime).toBe('2024-01-01T09:00:00.000Z');
  });

  it('lists supported timezones', async () => {
    const res = await request(app).get('/timezones');
    expect(res.status).toBe(200);
    expect(res.body.timezones).toContain('UTC');
    expect(res.body.timezones).toContain('Asia/Tokyo');
  });

  it('rejects unsupported timezone', async () => {
    const res = await request(app)
      .get('/convert')
      .query({ from: 'Mars/Space', to: 'UTC', time: '2024-01-01T00:00:00Z' });
    expect(res.status).toBe(400);
  });

  // BUG REPRODUCTION
  it('BUG: ignores DST for America/New_York in summer', async () => {
    // July 1, 2024 12:00 UTC = 08:00 EDT (UTC-4) in New York
    // But our fixed offset says -5, so it returns 07:00 instead of 08:00
    const result = convertTime('UTC', 'America/New_York', '2024-07-01T12:00:00Z');

    // Correct answer (with DST): 2024-07-01T08:00:00.000Z
    // Buggy answer (fixed -5): 2024-07-01T07:00:00.000Z
    expect(result.convertedTime).toBe('2024-07-01T08:00:00.000Z'); // FAILS until fixed
  });

  it('BUG: ignores DST for Europe/London in summer', async () => {
    // June 1, 2024 12:00 UTC = 13:00 BST (UTC+1) in London
    // Fixed offset says +1, which happens to match for London in summer,
    // but fails in winter (should be GMT/+0).
    const result = convertTime('UTC', 'Europe/London', '2024-01-15T12:00:00Z');

    // Correct answer (winter, no DST): 2024-01-15T12:00:00.000Z
    // Buggy answer (fixed +1): 2024-01-15T13:00:00.000Z
    expect(result.convertedTime).toBe('2024-01-15T12:00:00.000Z'); // FAILS until fixed
  });
});
