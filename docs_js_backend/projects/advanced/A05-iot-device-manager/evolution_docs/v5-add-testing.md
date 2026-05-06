# v5 — Adding Testing

You "optimized" the device registry by changing `devices.get(id)` to return a reference instead of a copy. You deploy. Now one device's status update corrupts another device's data because of shared object references. You have no test for registry isolation.

## The Fix: Automated Tests

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('IoT Device Manager', () => {
  it('registers a device', async () => {
    const res = await request(app)
      .post('/devices')
      .send({ id: 'sensor-01', name: 'Temp Sensor', type: 'sensor' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('registered');
  });

  it('retrieves device by id', async () => {
    await request(app)
      .post('/devices')
      .send({ id: 'sensor-02', name: 'Humidity Sensor', type: 'sensor' });

    const res = await request(app).get('/devices/sensor-02');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Humidity Sensor');
  });

  it('updates device status', async () => {
    await request(app)
      .post('/devices')
      .send({ id: 'sensor-03', name: 'Motion Sensor', type: 'sensor' });

    await request(app)
      .patch('/devices/sensor-03/status')
      .send({ status: 'online' })
      .expect(200);

    const res = await request(app).get('/devices/sensor-03');
    expect(res.body.status).toBe('online');
  });

  it('isolates device data', async () => {
    await request(app).post('/devices').send({ id: 'a', name: 'A', type: 'sensor' });
    await request(app).post('/devices').send({ id: 'b', name: 'B', type: 'sensor' });

    await request(app).patch('/devices/a/status').send({ status: 'online' });

    const b = await request(app).get('/devices/b');
    expect(b.body.status).toBe('offline'); // b should not be affected
  });

  it('rejects invalid device types', async () => {
    await request(app)
      .post('/devices')
      .send({ id: 'bad', name: 'Bad', type: 'hacker' })
      .expect(400);
  });
});
```

## What Tests Caught

- Registry isolation bug → caught
- Status update correctness → caught
- Invalid type rejection → caught
- Device retrieval → caught

## The Confidence

Now you can add MQTT, telemetry ingestion, or command dispatch and know that device registry invariants hold.

**Next:** Let's switch to ESM before building the real-time IoT stack.
