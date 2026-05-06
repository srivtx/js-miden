import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Ad Service', () => {
  it('should require auth for campaign creation', async () => {
    const res = await request(app).post('/ads/campaigns').send({ title: 'Test', content: 'Buy now' });
    expect(res.status).toBe(401);
  });
});
