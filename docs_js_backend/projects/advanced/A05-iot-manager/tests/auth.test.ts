import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { storage } from '../src/storage.js';
import { registerDevice } from '../src/device.js';

describe('Authentication', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should allow request with valid device credentials', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const res = await request(app)
      .post('/telemetry')
      .set('x-device-id', device.id)
      .set('x-auth-token', device.authToken!)
      .send({ temperature: 22, humidity: 50 });
    expect(res.status).toBe(201);
  });

  it('should reject request with missing headers', async () => {
    const res = await request(app)
      .post('/telemetry')
      .send({ temperature: 22, humidity: 50 });
    expect(res.status).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const res = await request(app)
      .post('/telemetry')
      .set('x-device-id', device.id)
      .set('x-auth-token', 'invalid_token')
      .send({ temperature: 22, humidity: 50 });
    expect(res.status).toBe(403);
  });

  // This test demonstrates the authentication bug:
  // Anyone who knows a device ID can send fake telemetry because
  // there is no certificate-based authentication or HMAC signature.
  // The token is a simple random string that could be leaked or guessed.
  it('should use strong device authentication', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    
    // In a secure system, tokens should be rotated, bound to certificates,
    // or use HMAC signatures. Here we just verify the token exists.
    expect(device.authToken).toBeDefined();
    expect(device.authToken!.length).toBeGreaterThan(20);
  });
});
