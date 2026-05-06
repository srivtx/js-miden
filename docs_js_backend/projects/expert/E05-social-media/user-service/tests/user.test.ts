import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { users } from '../src/routes.js';

describe('User Service', () => {
  beforeEach(() => {
    users.clear();
  });

  it('should register a user', async () => {
    const res = await request(app).post('/users/register').send({
      email: 'alice@example.com',
      username: 'alice',
      password: 'secret123',
      displayName: 'Alice',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('alice');
  });

  it('should login and return token', async () => {
    await request(app).post('/users/register').send({
      email: 'bob@example.com',
      username: 'bob',
      password: 'secret123',
    });
    const res = await request(app).post('/users/login').send({
      email: 'bob@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should get current user', async () => {
    const reg = await request(app).post('/users/register').send({
      email: 'carol@example.com',
      username: 'carol',
      password: 'secret123',
    });
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('carol');
  });
});
