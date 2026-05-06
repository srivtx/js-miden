import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initDb } from '../src/db.js';

describe('S30 Multi-Tenant Auth', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('registers a user in a tenant', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'alice@a.com', password: 'secret', tenantId: 'a' });
    expect(res.status).toBe(201);
  });

  it('logs in and accesses profile', async () => {
    await request(app).post('/register').send({ email: 'bob@b.com', password: 'secret', tenantId: 'b' });
    const login = await request(app).post('/login').send({ email: 'bob@b.com', password: 'secret', tenantId: 'b' });
    expect(login.status).toBe(200);

    const profile = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${login.body.token}`)
      .set('x-tenant-id', 'b');
    expect(profile.status).toBe(200);
  });

  it('BUG: user from tenant A can access tenant B with same user ID', async () => {
    // Register same email in tenant_a (will get id=1)
    await request(app).post('/register').send({ email: 'shared@x.com', password: 'secret', tenantId: 'a' });
    // Register same email in tenant_b (will get id=1)
    await request(app).post('/register').send({ email: 'shared@x.com', password: 'secret', tenantId: 'b' });

    const loginA = await request(app).post('/login').send({ email: 'shared@x.com', password: 'secret', tenantId: 'a' });
    expect(loginA.status).toBe(200);

    // Access tenant B using token from tenant A
    const profile = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${loginA.body.token}`)
      .set('x-tenant-id', 'b');

    // BUG: middleware does not validate that JWT tenant matches request tenant
    expect(profile.status).toBe(200);
  });
});
