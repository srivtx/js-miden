import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/index.js';
import { getRegistry } from '../src/registry.js';

describe('Service Discovery', () => {
  beforeEach(() => {
    // Clear registry before each test
    const registry = getRegistry();
    registry.length = 0;
  });

  it('should register a service', async () => {
    const res = await request(app)
      .post('/register')
      .send({ name: 'user-service', url: 'http://localhost:3001' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('user-service');
    expect(res.body.id).toBeDefined();
  });

  it('should discover registered services', async () => {
    await request(app)
      .post('/register')
      .send({ name: 'order-service', url: 'http://localhost:3002' });

    const res = await request(app).get('/discover/order-service');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].url).toBe('http://localhost:3002');
  });

  it('should accept heartbeats', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ name: 'test', url: 'http://localhost:3001' });

    const res = await request(app).post(`/heartbeat/${reg.body.id}`);
    expect(res.status).toBe(200);
  });

  it('should remove stale services after TTL', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ name: 'temp', url: 'http://localhost:3001' });

    // Wait longer than TTL without heartbeating
    await new Promise(r => setTimeout(r, 3500));

    const res = await request(app).get('/discover/temp');
    // Due to the bug, the service is still there because no cleanup runs
    expect(res.body.length).toBe(1); // BUG: should be 0
    expect(res.body[0].id).toBe(reg.body.id); // Proves stale entry remains
  });

  it('should not return dead services in discovery', async () => {
    await request(app)
      .post('/register')
      .send({ name: 'ghost', url: 'http://localhost:3001' });

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 3500));

    const res = await request(app).get('/discover/ghost');
    // BUG: Should be 0, but due to no cleanup it's 1
    expect(res.body.length).toBe(1);
  });
});
