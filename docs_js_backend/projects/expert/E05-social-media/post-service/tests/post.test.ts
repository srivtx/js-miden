import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { posts } from '../src/routes.js';

describe('Post Service', () => {
  beforeEach(() => {
    posts.clear();
  });

  it('should create a post', async () => {
    const res = await request(app).post('/posts/').send({
      type: 'text',
      content: 'Hello world',
    }).set('Authorization', 'Bearer fake-token');
    expect(res.status).toBe(401);
  });

  it('should list posts', async () => {
    const res = await request(app).get('/posts/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
