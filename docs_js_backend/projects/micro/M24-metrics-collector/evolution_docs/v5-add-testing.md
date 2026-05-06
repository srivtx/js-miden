# v5: Add Testing — Metrics Collector

## The Pain

You "optimize" percentile calculation by replacing `.sort()` with a quickselect algorithm. It compiles. You deploy. Now `p99` returns `NaN` for single-value metrics. Your SLA dashboard shows blank graphs during an incident. You find out from an angry executive, not from a test.

## The Solution

Jest + Supertest. Test statistics, time windows, and memory bounds.

## The Test File

```typescript
// tests/metrics-collector.test.ts
import request from 'supertest';
import { app, collector } from '../src/index.js';

describe('Metrics Collector', () => {
  beforeEach(() => {
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
      await request(app).post('/metrics').send({ name: 'latency', value });
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
    await request(app).post('/metrics').send({ name: 'requests', value: 1 });
    await new Promise(r => setTimeout(r, 200));
    await request(app).post('/metrics').send({ name: 'requests', value: 2 });

    const res = await request(app).get('/metrics/requests?windowMs=100');
    expect(res.body.count).toBe(1);
    expect(res.body.sum).toBe(2);
  });

  it('should prevent unbounded memory growth', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).post('/metrics').send({ name: 'growth_test', value: i });
    }

    const res = await request(app).get('/metrics/growth_test?windowMs=1');
    expect(res.body.count).toBeLessThan(100);
  });
});
```

## The Bug It Catches

The `should filter metrics by time window` test catches the intentional bug where time window filtering is commented out:

```typescript
// BEFORE: No time window filtering
getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
  // const cutoff = windowMs ? Date.now() - windowMs : 0;
  let records = this.metrics.get(name) || [];
  // records = records.filter(r => r.timestamp > cutoff);
  // ...
}
```

The test records two metrics 200ms apart, then queries with `windowMs=100`. Without filtering, both metrics are returned (`count=2`). With filtering, only the second is returned (`count=1`, `sum=2`).

## Why Tests Catch Breakage Before Deploy

- **Math accuracy**: `calculate correct statistics` catches off-by-one in percentile index
- **Memory safety**: `prevent unbounded memory growth` ensures OOM protection works
- **Temporal correctness**: `filter metrics by time window` validates eviction logic
- **Contract stability**: `record metrics` guarantees the POST → GET pipeline

Without tests, a refactoring that "simplifies" the time window check by removing it will pass code review and ship to production. With tests, `npm test` fails in CI.
