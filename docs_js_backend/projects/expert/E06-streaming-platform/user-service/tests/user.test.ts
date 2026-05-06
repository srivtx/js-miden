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
      password: 'secret123',
      displayName: 'Alice',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
  });
});
