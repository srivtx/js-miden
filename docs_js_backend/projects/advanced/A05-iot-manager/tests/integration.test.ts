import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { storage } from '../src/storage.js';
import { registerDevice } from '../src/device.js';
import { heartbeat } from '../src/heartbeat.js';

describe('Integration', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should register device and ingest telemetry', async () => {
    const regRes = await request(app)
      .post('/devices/register')
      .send({ name: 'Garden', type: 'multi' });
    expect(regRes.status).toBe(201);

    const device = regRes.body;

    const telRes = await request(app)
      .post('/telemetry')
      .set('x-device-id', device.id)
      .set('x-auth-token', device.authToken)
      .send({ temperature: 28, humidity: 60 });
    expect(telRes.status).toBe(201);
    expect(telRes.body.reading.temperature).toBe(28);
  });

  it('should send heartbeat and retrieve device status', async () => {
    const regRes = await request(app)
      .post('/devices/register')
      .send({ name: 'Garden', type: 'multi' });
    const device = regRes.body;

    const hbRes = await request(app)
      .post('/heartbeat')
      .set('x-device-id', device.id)
      .set('x-auth-token', device.authToken)
      .send({});
    expect(hbRes.status).toBe(200);
    expect(hbRes.body.device.status).toBe('online');

    const getRes = await request(app).get(`/devices/${device.id}`);
    expect(getRes.body.status).toBe('online');
  });

  it('should create command and retrieve pending', async () => {
    const regRes = await request(app)
      .post('/devices/register')
      .send({ name: 'Light', type: 'switch' });
    const device = regRes.body;

    const cmdRes = await request(app)
      .post(`/devices/${device.id}/commands`)
      .send({ type: 'turn_on' });
    expect(cmdRes.status).toBe(201);

    const pendingRes = await request(app).get(`/devices/${device.id}/commands/pending`);
    expect(pendingRes.body).toHaveLength(1);
  });

  it('should return alerts for high temperature telemetry', async () => {
    const regRes = await request(app)
      .post('/devices/register')
      .send({ name: 'Oven', type: 'temp' });
    const device = regRes.body;

    const telRes = await request(app)
      .post('/telemetry')
      .set('x-device-id', device.id)
      .set('x-auth-token', device.authToken)
      .send({ temperature: 50, humidity: 30 });
    expect(telRes.status).toBe(201);
    expect(telRes.body.alerts.length).toBeGreaterThan(0);

    const alertsRes = await request(app).get(`/devices/${device.id}/alerts`);
    expect(alertsRes.body.length).toBeGreaterThan(0);
  });
});
