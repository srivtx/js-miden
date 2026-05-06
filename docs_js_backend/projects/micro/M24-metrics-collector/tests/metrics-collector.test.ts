import request from 'supertest';
import { app, collector } from '../src/index.js';

describe('Metrics Collector', () => {
  beforeEach(() => {
    // Reset collector
    (collector as any).metrics = new Map();
  });

  it('should record metrics', async () => {
    await request(app)
      .post('/metrics')
      .send({ name: 'response_time', value: 150, tags: { endpoint: '/api' } });

    const res = await request(app).get('/metrics/response_time');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  it('should return 404 for unknown metrics', async () => {
    const res = await request(app).get('/metrics/unknown');
    expect(res.status).toBe(404);
  });

  it('should calculate correct statistics', async () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (const value of values) {
      await request(app)
        .post('/metrics')
        .send({ name: 'latency', value });
    }

    const res = await request(app).get('/metrics/latency');
    expect(res.body.count).toBe(10);
    expect(res.body.avg).toBe(55);
    expect(res.body.min).toBe(10);
    expect(res.body.max).toBe(100);
    expect(res.body.p95).toBeGreaterThanOrEqual(90);
    expect(res.body.p99).toBeGreaterThanOrEqual(95);
  });

  it('should filter metrics by time window', async () => {
    // Record old metric
    await request(app)
      .post('/metrics')
      .send({ name: 'requests', value: 1 });

    // Wait a bit
    await new Promise(r => setTimeout(r, 200));

    // Record new metric
    await request(app)
      .post('/metrics')
      .send({ name: 'requests', value: 2 });

    // Request with 100ms window should only return recent metrics
    const res = await request(app).get('/metrics/requests?windowMs=100');

    // BUG: No time window means all historical data returned
    // This test documents expected behavior
    expect(res.body.count).toBe(1); // Should only get the recent one
    expect(res.body.sum).toBe(2);
  });

  it('should prevent unbounded memory growth', async () => {
    // Simulate many metrics over time
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post('/metrics')
        .send({ name: 'growth_test', value: i });
    }

    const res = await request(app).get('/metrics/growth_test?windowMs=1');
    // With time window filtering, old metrics should be dropped
    // BUG: Without it, count is 100
    expect(res.body.count).toBeLessThan(100);
  });
});
