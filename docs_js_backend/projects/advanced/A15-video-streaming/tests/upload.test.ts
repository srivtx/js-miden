import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Upload API', () => {
  it('should create a video and start upload session', async () => {
    const videoRes = await request(app)
      .post('/api/videos')
      .send({
        title: 'Test Video',
        description: 'A test video',
        duration: 120,
        format: 'mp4',
        size: 1024 * 1024,
      });

    expect(videoRes.status).toBe(201);
    const videoId = videoRes.body.id;

    const uploadRes = await request(app)
      .post('/api/videos/start')
      .send({
        videoId,
        filename: 'test.mp4',
        mimeType: 'video/mp4',
        size: 1024 * 1024,
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body).toHaveProperty('sessionId');
  });

  it('should reject upload for non-existent video', async () => {
    const res = await request(app)
      .post('/api/videos/start')
      .send({
        videoId: 'non-existent-id',
        filename: 'test.mp4',
        mimeType: 'video/mp4',
        size: 1024,
      });

    expect(res.status).toBe(404);
  });
});
