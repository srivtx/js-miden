import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Telemetry Ingestion', () => {
  it('should ingest telemetry for a registered device', async () => {
    // Register device
    const deviceRes = await request(app)
      .post('/api/devices')
      .send({ name: 'Temp Sensor', type: 'sensor', firmwareVersion: '1.0.0' });

    expect(deviceRes.status).toBe(201);
    const deviceId = deviceRes.body.id;

    // Ingest telemetry
    const res = await request(app)
      .post('/api/telemetry')
      .set('x-device-id', deviceId)
      .send({
        deviceId,
        measurements: { temperature: 23.5, humidity: 60 },
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ingested');
  });

  it('BUG: should allow spoofing any deviceId without authentication', async () => {
    // No need to register the device - just use any ID
    const spoofedDeviceId = 'fake-device-123';

    const res = await request(app)
      .post('/api/telemetry')
      .send({
        deviceId: spoofedDeviceId,
        measurements: { temperature: 99.9 },
      });

    // BUG: The server accepts telemetry from unauthenticated/unregistered devices.
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ingested');
  });

  it('BUG: should allow publishing as another registered device', async () => {
    // Register a legitimate device
    const legitRes = await request(app)
      .post('/api/devices')
      .send({ name: 'Legit Sensor', type: 'sensor', firmwareVersion: '1.0.0' });

    const legitDeviceId = legitRes.body.id;

    // Attacker sends telemetry claiming to be the legitimate device
    const attackerRes = await request(app)
      .post('/api/telemetry')
      .send({
        deviceId: legitDeviceId,
        measurements: { temperature: 999 },
      });

    // BUG: No cryptographic proof required - server trusts the deviceId.
    expect(attackerRes.status).toBe(201);
  });
});
