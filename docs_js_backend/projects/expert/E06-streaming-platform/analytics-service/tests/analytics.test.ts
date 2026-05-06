import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Analytics Service', () => {
  it('should require auth', async () => {
    const res = await request(app).post('/analytics/events').send({ profileId: 'p1', videoId: 'v1', eventType: 'start' });
    expect(res.status).toBe(401);
  });
});
