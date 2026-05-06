import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool, initDb } from '../src/db.js';

beforeAll(async () => {
  await initDb();
  await pool.query("DELETE FROM notes WHERE title LIKE 'test-%'");
});

afterAll(async () => {
  await pool.end();
});

describe('S05 Note API', () => {
  it('creates a note', async () => {
    const res = await request(app).post('/notes').send({ title: 'test-a', content: 'hello world' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('test-a');
  });

  it('lists notes with pagination', async () => {
    const res = await request(app).get('/notes?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('searches notes', async () => {
    const res = await request(app).get('/notes?q=hello');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('updates a note', async () => {
    const create = await request(app).post('/notes').send({ title: 'test-b', content: 'update me' });
    const id = create.body.id;
    const res = await request(app).put(`/notes/${id}`).send({ title: 'test-b-updated', content: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('test-b-updated');
  });

  it('soft deletes a note', async () => {
    const create = await request(app).post('/notes').send({ title: 'test-c', content: 'delete me' });
    const id = create.body.id;
    await request(app).delete(`/notes/${id}`).expect(204);
    await request(app).get(`/notes/${id}`).expect(404);
  });
});
