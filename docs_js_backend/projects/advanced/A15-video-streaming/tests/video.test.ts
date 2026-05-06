import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Video API', () => {
  it('should create and retrieve a video', async () => {
    const createRes = await request(app)
      .post('/api/videos')
      .send({
        title: 'My Video',
        description: 'Description',
        duration: 300,
        format: 'mp4',
        size: 5000000,
      });

    expect(createRes.status).toBe(201);
    const videoId = createRes.body.id;

    const getRes = await request(app).get(`/api/videos/${videoId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('My Video');
  });

  it('should return 404 for missing video', async () => {
    const res = await request(app).get('/api/videos/non-existent');
    expect(res.status).toBe(404);
  });
});
