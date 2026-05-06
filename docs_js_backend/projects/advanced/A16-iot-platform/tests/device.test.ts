import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Device API', () => {
  it('should register a device', async () => {
    const res = await request(app)
      .post('/api/devices')
      .send({ name: 'Test Device', type: 'gateway', firmwareVersion: '2.0.0' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('offline');
  });

  it('should list devices', async () => {
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should get a device by id', async () => {
    const createRes = await request(app)
      .post('/api/devices')
      .send({ name: 'Find Me', type: 'sensor', firmwareVersion: '1.0.0' });

    const id = createRes.body.id;
    const res = await request(app).get(`/api/devices/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });
});
