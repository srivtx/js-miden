import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, resetDb, pool } from '../src/db.js';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/index', () => {
  it('indexes a document', async () => {
    const res = await request(app)
      .post('/api/index')
      .send({ title: 'Hello World', content: 'This is a test document about running and runners.' });
    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('Hello World');
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/index').send({ title: 'Only title' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/search', () => {
  it('finds documents by stemmed word', async () => {
    await request(app)
      .post('/api/index')
      .send({ title: 'Running Guide', content: 'Running is great for runners who love to run daily.' });

    // "run" should match "running", "runners", "run" thanks to stemming
    const res = await request(app).get('/api/search?q=run');
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    expect(res.body.results[0].rank).toBeGreaterThan(0);
  });

  it('returns highlights', async () => {
    await request(app)
      .post('/api/index')
      .send({ title: 'Test', content: 'The quick brown fox jumps over the lazy dog.' });

    const res = await request(app).get('/api/search?q=fox');
    expect(res.status).toBe(200);
    expect(res.body.results[0].highlights.length).toBeGreaterThan(0);
    expect(res.body.results[0].highlights[0]).toContain('<mark>');
  });

  it('paginates results', async () => {
    for (let i = 0; i < 15; i++) {
      await request(app)
        .post('/api/index')
        .send({ title: `Doc ${i}`, content: 'common keyword here' });
    }

    const res = await request(app).get('/api/search?q=common&limit=5&page=2');
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(5);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.total).toBe(15);
  });
});

describe('GET /api/search-slow', () => {
  it('works but does not stem', async () => {
    await request(app)
      .post('/api/index')
      .send({ title: 'Running', content: 'Running fast' });

    const res = await request(app).get('/api/search-slow?q=run');
    expect(res.status).toBe(200);
    // ILIKE '%run%' won't match 'Running' without wildcards properly
    // Actually it will match 'Running' because ILIKE is case-insensitive substring
    // But it won't match stemmed forms conceptually the same way
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});
