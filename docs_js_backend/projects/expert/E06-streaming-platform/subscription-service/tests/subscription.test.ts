import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Subscription Service', () => {
  it('should require auth', async () => {
    const res = await request(app).get('/subscriptions/me');
    expect(res.status).toBe(401);
  });
});
