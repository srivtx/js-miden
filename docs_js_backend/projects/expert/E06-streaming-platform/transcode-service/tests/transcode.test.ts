import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Transcode Service', () => {
  it('should require auth', async () => {
    const res = await request(app).post('/transcode/').send({ uploadId: 'u1' });
    expect(res.status).toBe(401);
  });
});
