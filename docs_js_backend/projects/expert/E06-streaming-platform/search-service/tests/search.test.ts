import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Search Service', () => {
  it('should require auth', async () => {
    const res = await request(app).get('/search?q=matrix');
    expect(res.status).toBe(401);
  });
});
