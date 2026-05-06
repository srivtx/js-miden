import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Feed Service', () => {
  it('should require auth', async () => {
    const res = await request(app).get('/feed/');
    expect(res.status).toBe(401);
  });
});
