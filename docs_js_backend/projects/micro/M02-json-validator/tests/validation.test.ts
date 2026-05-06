import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /validate', () => {
  it('accepts a valid user object', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: 25 });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.data).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      age: 25,
    });
  });

  it('rejects a name that is too short', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'A', email: 'a@example.com', age: 25 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'not-an-email', age: 25 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })])
    );
  });

  it('rejects age below 18', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: 17 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'age' })])
    );
  });

  it('rejects age above 120', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: 121 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'age' })])
    );
  });

  it('rejects string age (no type coercion)', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: '25' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'age' })])
    );
  });

  it('strips unknown fields (security)', async () => {
    const res = await request(app)
      .post('/validate')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('role');
  });
});
