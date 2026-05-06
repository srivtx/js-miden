import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { storage } from '../src/storage.js';
import { registerDevice } from '../src/device.js';
import { recordTelemetry, getTelemetry, getLatestTelemetry } from '../src/telemetry.js';

describe('Telemetry', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should record telemetry readings', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const reading = await recordTelemetry({
      deviceId: device.id,
      temperature: 22.5,
      humidity: 55,
    });
    expect(reading.temperature).toBe(22.5);
    expect(reading.humidity).toBe(55);
  });

  it('should retrieve telemetry for a device', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    await recordTelemetry({ deviceId: device.id, temperature: 20, humidity: 50 });
    await recordTelemetry({ deviceId: device.id, temperature: 21, humidity: 51 });
    const readings = await getTelemetry(device.id);
    expect(readings).toHaveLength(2);
  });

  it('should return latest telemetry first', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    await recordTelemetry({ deviceId: device.id, temperature: 20, humidity: 50, timestamp: 1000 });
    await recordTelemetry({ deviceId: device.id, temperature: 25, humidity: 55, timestamp: 2000 });
    const latest = await getLatestTelemetry(device.id);
    expect(latest!.temperature).toBe(25);
  });

  it('should reject invalid telemetry via API', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const res = await request(app)
      .post('/telemetry')
      .set('x-device-id', device.id)
      .set('x-auth-token', device.authToken!)
      .send({ temperature: 'hot', humidity: 50 });
    expect(res.status).toBe(400);
  });
});
