import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Alert Rules', () => {
  it('should create an alert rule and trigger on telemetry', async () => {
    const ruleRes = await request(app)
      .post('/api/alerts')
      .set('x-api-key', 'admin-secret')
      .send({
        name: 'High Temp Alert',
        condition: { measurement: 'temperature', operator: 'gt', threshold: 50 },
        actions: [{ type: 'webhook', target: 'https://example.com/alerts' }],
        enabled: true,
      });

    expect(ruleRes.status).toBe(201);

    // Ingest telemetry that triggers the rule
    const telemetryRes = await request(app)
      .post('/api/telemetry')
      .send({
        deviceId: 'any-device',
        measurements: { temperature: 60 },
      });

    expect(telemetryRes.status).toBe(201);
    expect(telemetryRes.body.alerts.length).toBeGreaterThan(0);
  });

  it('should require admin key to create rules', async () => {
    const res = await request(app)
      .post('/api/alerts')
      .send({
        name: 'Unauthorized Rule',
        condition: { measurement: 'x', operator: 'gt', threshold: 1 },
        actions: [],
        enabled: true,
      });

    expect(res.status).toBe(403);
  });
});
