import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('API Key Manager', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM api_keys').run();
  });

  it('generates an API key', async () => {
    const res = await request(app).post('/keys').send({ name: 'Test Key' });
    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^pk_live_[a-f0-9]{64}$/);
  });

  it('lists active keys', async () => {
    await request(app).post('/keys').send({ name: 'Test' });
    const res = await request(app).get('/keys');
    expect(res.status).toBe(200);
    expect(res.body.keys.length).toBe(1);
  });

  it('revokes a key', async () => {
    await request(app).post('/keys').send({ name: 'Test' });
    const row = db.prepare('SELECT id FROM api_keys').get() as { id: number };
    const res = await request(app).delete(`/keys/${row.id}`);
    expect(res.status).toBe(200);

    const list = await request(app).get('/keys');
    expect(list.body.keys.length).toBe(0);
  });

  it('protects routes with valid key', async () => {
    const create = await request(app).post('/keys').send({ name: 'Test' });
    const key = create.body.key;

    const res = await request(app).get('/protected').set('x-api-key', key);
    expect(res.status).toBe(200);
  });

  it('rejects invalid key', async () => {
    const res = await request(app).get('/protected').set('x-api-key', 'pk_live_invalid');
    expect(res.status).toBe(401);
  });

  it('BUG: stores API key in plaintext', async () => {
    await request(app).post('/keys').send({ name: 'Test' });
    const row = db.prepare('SELECT key_hash FROM api_keys').get() as { key_hash: string };
    // The full key is stored in key_hash column, not a SHA-256 hash
    expect(row.key_hash).toMatch(/^pk_live_[a-f0-9]{64}$/);
    expect(row.key_hash.startsWith('pk_live_')).toBe(true);
  });
});
