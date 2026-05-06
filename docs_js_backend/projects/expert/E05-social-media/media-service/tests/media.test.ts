import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Media Service', () => {
  it('should require auth for upload', async () => {
    const res = await request(app).post('/media/upload').send({ type: 'image', url: 'http://example.com/img.jpg' });
    expect(res.status).toBe(401);
  });
});
