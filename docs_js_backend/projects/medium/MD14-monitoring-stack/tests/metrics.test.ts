import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { clearStore } from '../src/services/metricStore.js';
import { clearRules } from '../src/services/alertEngine.js';

beforeEach(() => {
  clearStore();
  clearRules();
});

describe('Metrics API', () => {
  it('should record a counter metric', async () => {
    const res = await request(app)
      .post('/metrics')
      .send({ name: 'http_requests_total', type: 'counter', value: 1, labels: { method: 'GET', status: '200' } });

    expect(res.status).toBe(201);
  });

  it('should query metrics by name', async () => {
    await request(app)
      .post('/metrics')
      .send({ name: 'cpu_usage', type: 'gauge', value: 45.2, labels: { host: 'srv-1' } });

    const res = await request(app).get('/metrics/cpu_usage');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].values[0].value).toBe(45.2);
  });

  it('should reject invalid metric type', async () => {
    const res = await request(app)
      .post('/metrics')
      .send({ name: 'x', type: 'invalid', value: 1 });

    expect(res.status).toBe(400);
  });
});

describe('Alert Rules', () => {
  it('should create an alert rule', async () => {
    const res = await request(app)
      .post('/alerts/rules')
      .send({
        id: 'rule-1',
        name: 'High CPU',
        metricName: 'cpu_usage',
        labels: {},
        condition: 'gt',
        threshold: 80,
        durationMs: 30000,
        severity: 'critical',
      });

    expect(res.status).toBe(201);
  });

  it('should trigger alert when threshold exceeded', async () => {
    await request(app)
      .post('/alerts/rules')
      .send({
        id: 'rule-1',
        name: 'High CPU',
        metricName: 'cpu_usage',
        labels: {},
        condition: 'gt',
        threshold: 80,
        durationMs: 0,
        severity: 'critical',
      });

    await request(app)
      .post('/metrics')
      .send({ name: 'cpu_usage', type: 'gauge', value: 95 });

    const res = await request(app).get('/alerts/states');
    expect(res.status).toBe(200);
    const state = res.body.data.find((s: any) => s.ruleId === 'rule-1');
    expect(state?.active).toBe(true);
  });
});

describe('BUG: Alert Flapping', () => {
  it('should NOT resolve immediately when value dips below threshold (hysteresis required)', async () => {
    await request(app)
      .post('/alerts/rules')
      .send({
        id: 'rule-flap',
        name: 'Flap Test',
        metricName: 'temp',
        labels: {},
        condition: 'gt',
        threshold: 100,
        durationMs: 5000,
        severity: 'warning',
      });

    // Push value above threshold
    await request(app).post('/metrics').send({ name: 'temp', type: 'gauge', value: 110 });

    // Evaluate
    let res = await request(app).get('/alerts/states');
    let state = res.body.data.find((s: any) => s.ruleId === 'rule-flap');
    expect(state?.active).toBe(true);

    // Push value slightly below threshold immediately
    await request(app).post('/metrics').send({ name: 'temp', type: 'gauge', value: 99 });

    res = await request(app).get('/alerts/states');
    state = res.body.data.find((s: any) => s.ruleId === 'rule-flap');

    // BUG: The alert resolves immediately. In a real system, it should stay active
    // for durationMs or use hysteresis to prevent flapping.
    // This assertion WILL FAIL because of the bug, demonstrating flapping.
    expect(state?.active).toBe(true);
  });
});

describe('BUG: Cardinality Explosion', () => {
  it('should limit the number of unique label combinations per metric', async () => {
    // Simulating a user putting a unique requestId into labels
    const promises: Promise<any>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        request(app)
          .post('/metrics')
          .send({
            name: 'http_requests_total',
            type: 'counter',
            value: 1,
            labels: { requestId: `req-${i}`, method: 'GET' },
          })
      );
    }
    await Promise.all(promises);

    const res = await request(app).get('/dashboard/series');
    expect(res.status).toBe(200);

    // BUG: There should be a cardinality limit (e.g., 10 unique series per metric),
    // but the system allows unlimited unique label combinations.
    // This test WILL FAIL because seriesCount is 100 instead of <= 10.
    expect(res.body.data.count).toBeLessThanOrEqual(10);
  });
});

describe('BUG: No Retention Policy', () => {
  it('should automatically prune data older than retention period', async () => {
    const oldTime = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago

    await request(app)
      .post('/metrics')
      .send({
        name: 'memory_usage',
        type: 'gauge',
        value: 50,
        timestamp: oldTime,
      });

    await request(app)
      .post('/metrics')
      .send({
        name: 'memory_usage',
        type: 'gauge',
        value: 60,
        timestamp: Date.now(),
      });

    // Without calling /dashboard/prune manually, old data should be gone
    const res = await request(app).get('/metrics/memory_usage');
    const series = res.body.data[0];

    // BUG: No automatic retention pruning. Old 48h data is still present.
    // This test WILL FAIL because values.length is 2 instead of 1.
    expect(series.values.length).toBe(1);
    expect(series.values[0].value).toBe(60);
  });
});
