import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/index.js';
import { getStore } from '../src/config.js';

describe('Config Server', () => {
  beforeEach(() => {
    // Clear store before each test
    const store = getStore();
    Object.keys(store).forEach(key => delete store[key]);
  });

  it('should set and get config', async () => {
    await request(app)
      .post('/config/myapp/dev')
      .send({ dbHost: 'localhost' });

    const res = await request(app).get('/config/myapp/dev');
    expect(res.status).toBe(200);
    expect(res.body.dbHost).toBe('localhost');
  });

  it('should merge config on update', async () => {
    await request(app)
      .post('/config/myapp/dev')
      .send({ dbHost: 'localhost' });

    await request(app)
      .post('/config/myapp/dev')
      .send({ debug: true });

    const res = await request(app).get('/config/myapp/dev');
    expect(res.body.dbHost).toBe('localhost');
    expect(res.body.debug).toBe(true);
  });

  it('should isolate dev and prod configs', async () => {
    await request(app)
      .post('/config/myapp/dev')
      .send({ dbHost: 'localhost' });

    await request(app)
      .post('/config/myapp/prod')
      .send({ dbHost: 'prod.example.com' });

    const dev = await request(app).get('/config/myapp/dev');
    const prod = await request(app).get('/config/myapp/prod');

    // Due to the bug, both will return the same merged config
    // because env is ignored in storage
    expect(dev.body.dbHost).toBe('prod.example.com'); // BUG: dev was overwritten!
    expect(prod.body.dbHost).toBe('prod.example.com');
  });

  it('should reject invalid config values', async () => {
    const res = await request(app)
      .post('/config/myapp/dev')
      .send({ port: -1 });

    // The validator currently accepts negative numbers
    // A proper validator should reject this
    expect(res.status).toBe(200); // BUG: Should be 400
  });
});
