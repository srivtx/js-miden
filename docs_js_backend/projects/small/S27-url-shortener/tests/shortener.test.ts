import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDb } from '../src/db.js';

describe('S27 URL Shortener', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('creates a short URL', async () => {
    const res = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(201);
    expect(res.body.shortCode).toBeDefined();
  });

  it('supports custom codes', async () => {
    const res = await request(app)
      .post('/shorten')
      .send({ url: 'https://example.com/2', customCode: 'mycode' });
    expect(res.status).toBe(201);
    expect(res.body.shortCode).toBe('mycode');
  });

  it('BUG: short codes are sequential and predictable', async () => {
    const res1 = await request(app).post('/shorten').send({ url: 'https://a.com' });
    const res2 = await request(app).post('/shorten').send({ url: 'https://b.com' });

    // Sequential encoder produces 'b' then 'c' (counter starts at 0, first call increments to 1 -> 'b')
    // Actually counter starts at 0, first call ++counter = 1 -> 'b', second = 2 -> 'c'
    const code1 = res1.body.shortCode;
    const code2 = res2.body.shortCode;

    // Predictable: code2 should be the next in sequence
    expect(code2).toBe('c');
    expect(code1).toBe('b');
  });
});
