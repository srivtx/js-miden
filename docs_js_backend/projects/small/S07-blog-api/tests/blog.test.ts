import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, server } from '../src/index.js';
import { db } from '../src/db.js';

beforeAll(() => {
  db.prepare("DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE title LIKE 'test-%')").run();
  db.prepare("DELETE FROM posts WHERE title LIKE 'test-%'").run();
});

afterAll(() => {
  server.close();
});

describe('S07 Blog API', () => {
  it('creates a post', async () => {
    const res = await request(app).post('/posts').send({ title: 'test-hello', content: 'world' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('test-hello');
  });

  it('lists posts with comment counts', async () => {
    const create = await request(app).post('/posts').send({ title: 'test-count', content: 'count me' });
    const id = create.body.id;
    await request(app).post(`/posts/${id}/comments`).send({ content: 'nice' });
    await request(app).post(`/posts/${id}/comments`).send({ content: 'great' });

    const res = await request(app).get('/posts');
    expect(res.status).toBe(200);
    const post = res.body.find((p: any) => p.id === id);
    expect(post).toBeDefined();
    expect(post.commentCount).toBe(2);
  });

  it('soft deletes a post', async () => {
    const create = await request(app).post('/posts').send({ title: 'test-del', content: 'delete me' });
    const id = create.body.id;
    await request(app).delete(`/posts/${id}`).expect(204);
    await request(app).get(`/posts/${id}`).expect(404);
  });

  it('creates comments under a post', async () => {
    const create = await request(app).post('/posts').send({ title: 'test-comments', content: 'comments' });
    const id = create.body.id;
    const res = await request(app).post(`/posts/${id}/comments`).send({ content: 'first' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('first');
  });

  it('BUG: accepts huge comments without length validation', async () => {
    const create = await request(app).post('/posts').send({ title: 'test-spam', content: 'spam' });
    const id = create.body.id;
    const huge = 'x'.repeat(50000);
    const res = await request(app).post(`/posts/${id}/comments`).send({ content: huge });
    expect(res.status).toBe(201);
  });
});
