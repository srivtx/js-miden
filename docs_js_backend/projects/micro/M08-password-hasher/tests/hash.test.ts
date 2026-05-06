import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('POST /hash', () => {
  it('returns a 64-char hex sha256 hash', async () => {
    const res = await request(app).post('/hash').send({ password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body.hash).toHaveLength(64);
    expect(res.body.hash).toMatch(/^[a-f0-9]+$/);
  });

  it('returns identical hash for identical passwords (no salt bug)', async () => {
    const res1 = await request(app).post('/hash').send({ password: 'abc' });
    const res2 = await request(app).post('/hash').send({ password: 'abc' });
    expect(res1.body.hash).toBe(res2.body.hash);
  });
});

describe('POST /verify', () => {
  it('returns true for a matching password', async () => {
    const hashRes = await request(app).post('/hash').send({ password: 'secret' });
    const verifyRes = await request(app)
      .post('/verify')
      .send({ password: 'secret', hash: hashRes.body.hash });
    expect(verifyRes.body.match).toBe(true);
  });

  it('returns false for a non-matching password', async () => {
    const verifyRes = await request(app)
      .post('/verify')
      .send({ password: 'wrong', hash: 'a'.repeat(64) });
    expect(verifyRes.body.match).toBe(false);
  });
});
