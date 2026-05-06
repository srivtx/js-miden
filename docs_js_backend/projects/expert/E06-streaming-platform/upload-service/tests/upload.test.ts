import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Upload Service', () => {
  it('should require auth', async () => {
    const res = await request(app).post('/uploads/').send({ originalFilename: 'video.mp4', mimeType: 'video/mp4' });
    expect(res.status).toBe(401);
  });
});
