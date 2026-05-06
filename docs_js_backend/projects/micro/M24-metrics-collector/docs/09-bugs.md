# Bugs: Metrics Collector

## Bug 1: No Time Window

### Location
`src/metrics-collector.ts` - `getMetrics()` method

### The Bug

```typescript
getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
  // BUG: No time window filtering
  let records = this.metrics.get(name) || [];

  // Should filter but doesn't:
  // records = records.filter(r => r.timestamp > cutoff);

  // ... computes on ALL records
}
```

### Expected Behavior
Should only include records within the specified time window.

### Actual Behavior
Returns all historical data, causing unbounded memory growth.

### Impact
- Memory grows until OOM
- Query latency increases over time
- Inaccurate recent metrics diluted by old data
- Performance degradation

### Failing Test
```typescript
it('should filter metrics by time window', async () => {
  await request(app).post('/metrics').send({ name: 'requests', value: 1 });
  await sleep(200);
  await request(app).post('/metrics').send({ name: 'requests', value: 2 });

  const res = await request(app).get('/metrics/requests?windowMs=100');
  expect(res.body.count).toBe(1); // FAILS - returns 2
  expect(res.body.sum).toBe(2);
});
```

### The Fix

```typescript
getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
  const cutoff = windowMs ? Date.now() - windowMs : 0;
  let records = this.metrics.get(name) || [];

  // Filter by time window
  records = records.filter(r => r.timestamp > cutoff);

  if (records.length === 0) return null;

  const values = records.map(r => r.value).sort((a, b) => a - b);
  // ... compute aggregations
}
```

---

## Bug 2: Average Calculation Wrong

### Location
`src/metrics-collector.ts` - aggregation logic

### The Bug
Simple sum/count can overflow or accumulate floating-point errors.

### Expected Behavior
Numerically stable average calculation.

### Actual Behavior
Potential overflow with large values or many records.

### Impact
- Incorrect averages
- Infinity/NaN results
- Misleading dashboards
- Wrong business decisions

### Failing Test
```typescript
it('should handle large values without overflow', () => {
  const collector = new MetricsCollector();
  for (let i = 0; i < 1000000; i++) {
    collector.record('large', Number.MAX_SAFE_INTEGER);
  }

  const metrics = collector.getMetrics('large');
  expect(metrics.avg).toBe(Number.MAX_SAFE_INTEGER);
  expect(Number.isFinite(metrics.avg)).toBe(true);
});
```

### The Fix
Use Welford's algorithm for running average:

```typescript
class RunningStats {
  count = 0;
  mean = 0;
  m2 = 0;

  add(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  get average(): number {
    return this.mean;
  }
}
```
