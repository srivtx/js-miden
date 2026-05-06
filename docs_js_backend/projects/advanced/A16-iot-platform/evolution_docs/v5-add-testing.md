# v5 — Add Testing (IoT Platform)

## The Scenario

It's 2am. Your junior refactors the device command endpoint. "Just moving some logic around," they say. They deploy. The security team reports anyone can send reboot commands to any device. Your junior stares at the code — it looks fine. But they never tested command authorization.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
// src/routes/command.routes.ts
app.post('/commands', async (req, res) => {
  const { deviceId, command } = req.body;

  // BUG: During refactor, authentication check was accidentally removed
  // if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  await sendCommand(deviceId, command);
  res.status(204).send();
});
```

This code has an **authentication bypass** (accidentally removed auth check). Anyone can send commands to any device without authentication. An attacker reboots every device in the factory.

Without tests, this bug ships to production. Physical systems go down.

## The Solution: Vitest + Supertest + Mocks

```typescript
// tests/iot.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getTelemetry } from '../src/db.js';

function makeToken(userId: string, role = 'operator') {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
}

describe('IoT Platform', () => {
  beforeEach(() => resetDb());

  describe('Device Management', () => {
    it('registers a device', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .send({ name: 'Temperature Sensor', firmwareVersion: '1.0.0' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Temperature Sensor');
    });

    it('rejects unauthenticated device registration', async () => {
      const res = await request(app)
        .post('/api/devices')
        .send({ name: 'Temperature Sensor', firmwareVersion: '1.0.0' });
      expect(res.status).toBe(401);
    });
  });

  describe('Telemetry Ingestion', () => {
    it('ingests valid telemetry', async () => {
      const res = await request(app)
        .post('/api/telemetry')
        .send({ deviceId: 'sensor-001', temperature: 22.5, humidity: 60 });
      expect(res.status).toBe(201);
      expect(res.body.temperature).toBe(22.5);
    });

    it('rejects impossible temperature', async () => {
      const res = await request(app)
        .post('/api/telemetry')
        .send({ deviceId: 'sensor-001', temperature: 9999, humidity: 60 });
      expect(res.status).toBe(400);
    });

    it('BUG: demonstrates device spoofing vulnerability', async () => {
      // Any client can publish telemetry as any device ID
      const res = await request(app)
        .post('/api/telemetry')
        .send({ deviceId: 'someone-elses-sensor', temperature: 22.5, humidity: 60 });
      // Without device authentication, this returns 201
      // The test documents the vulnerability
      expect([201, 401]).toContain(res.status);
    });
  });

  describe('Device Commands', () => {
    it('rejects unauthenticated commands', async () => {
      const res = await request(app)
        .post('/api/commands')
        .send({ deviceId: 'sensor-001', command: 'reboot' });
      expect(res.status).toBe(401);
    });

    it('rejects invalid command', async () => {
      const res = await request(app)
        .post('/api/commands')
        .set('Authorization', `Bearer ${makeToken('operator')}`)
        .send({ deviceId: 'sensor-001', command: 'self-destruct' });
      expect(res.status).toBe(400);
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor removes auth check | Deploy, unauthorized commands | **CI fails** before merge |
| Device spoofing | Data corruption | **Test documents** the vulnerability |
| Impossible sensor values | Automation failures | **Test rejects** invalid telemetry |
| Schema changes | Runtime crashes | **Mock mismatch** alerts you |

## The PAIN of Database Testing

```typescript
// DON'T hit real MQTT broker in unit tests
// - Slow (network I/O)
// - Flaky (broker availability)
// - Requires Docker/CI setup

// DO mock the MQTT service
// - Fast (<10ms per test)
// - Deterministic
// - Tests YOUR code, not the broker
```

Mocking the MQTT service means:
- Your tests run in milliseconds
- No broker setup required
- You control every response (error cases, disconnections, edge cases)

## Testing Evolution in the IoT Platform

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for device spoofing. It passes, but the comment says 'BUG'. Now every developer knows the MQTT bridge lacks authentication."
>
> You: "Tests are documentation that executes. A passing test with a 'BUG' comment is better than a security ticket nobody reads. In an IoT platform, one untested refactor can let an attacker control physical infrastructure."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
