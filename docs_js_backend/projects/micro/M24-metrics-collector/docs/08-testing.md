# Testing: Metrics Collector

## Test Strategy

### Unit Tests

Test aggregation logic:

```typescript
describe('MetricsCollector', () => {
  it('calculates correct average', () => {
    const collector = new MetricsCollector();
    collector.record('latency', 10);
    collector.record('latency', 20);
    collector.record('latency', 30);

    const metrics = collector.getMetrics('latency');
    expect(metrics.avg).toBe(20);
  });

  it('calculates correct percentiles', () => {
    const collector = new MetricsCollector();
    for (let i = 1; i <= 100; i++) {
      collector.record('latency', i);
    }

    const metrics = collector.getMetrics('latency');
    expect(metrics.p95).toBe(95);
    expect(metrics.p99).toBe(99);
  });
});
```

### Time Window Tests

```typescript
it('filters by time window', async () => {
  const collector = new MetricsCollector();

  collector.record('requests', 1); // old
  await sleep(200);
  collector.record('requests', 2); // new

  const metrics = collector.getMetrics('requests', 100);
  expect(metrics.count).toBe(1);
  expect(metrics.sum).toBe(2);
});
```

### Memory Tests

```typescript
it('does not grow unbounded', () => {
  const collector = new MetricsCollector();

  for (let i = 0; i < 10000; i++) {
    collector.record('test', i);
  }

  // Query with 1ms window should return nothing
  const metrics = collector.getMetrics('test', 1);
  expect(metrics).toBeNull();
});
```

### Integration Tests

```typescript
it('POST /metrics records metric', async () => {
  await request(app)
    .post('/metrics')
    .send({ name: 'cpu', value: 50, tags: { host: 'server1' } });

  const res = await request(app).get('/metrics/cpu');
  expect(res.body.count).toBe(1);
  expect(res.body.avg).toBe(50);
});
```

## Test Checklist

- [ ] Records metrics
- [ ] Computes correct count
- [ ] Computes correct average
- [ ] Computes correct min/max
- [ ] Computes correct p95/p99
- [ ] Filters by time window
- [ ] Memory is bounded
- [ ] Handles missing metrics
- [ ] Supports tags
- [ ] Performance acceptable
