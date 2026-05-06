# Step-by-Step Build Guide

## Step 1: Define Metric Types

Create the core types for metrics, labels, and time series.

```typescript
export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricValue {
  timestamp: number;
  value: number;
}

export interface TimeSeries {
  name: string;
  type: MetricType;
  labels: Record<string, string>;
  values: MetricValue[];
}
```

### Common Mistakes
- **Mistake**: Using `any` for labels.
- **Why it breaks**: No validation means arbitrary keys/values, leading to injection attacks or cardinality explosion.
- **How to avoid**: Strict `Record<string, string>` with max key/value lengths.

## Step 2: Build the Metric Store

Implement an in-memory map keyed by `name{labels}`.

```typescript
const timeSeriesMap = new Map<string, TimeSeries>();

function seriesKey(name: string, labels: Labels): string {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${name}{${labelStr}}`;
}

export function recordMetric(name: string, type: MetricType, value: number, labels: Labels = {}): void {
  const key = seriesKey(name, labels);
  let ts = timeSeriesMap.get(key);
  if (!ts) {
    ts = { name, type, labels, values: [] };
    timeSeriesMap.set(key, ts);
  }
  ts.values.push({ timestamp: Date.now(), value });
}
```

### Common Mistakes
- **Mistake**: Not sorting labels before keying.
- **Why it breaks**: `{a=1,b=2}` and `{b=2,a=1}` become different keys for the same series.
- **How to avoid**: Always sort labels lexicographically.

## Step 3: Add Alert Rules

Define alert rules with thresholds and conditions.

```typescript
export interface AlertRule {
  id: string;
  metricName: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  durationMs: number; // Must hold for this long
  severity: 'warning' | 'critical';
}
```

### Common Mistakes
- **Mistake**: Firing alerts immediately when threshold is crossed.
- **Why it breaks**: Metric oscillation around threshold causes pager storms.
- **How to avoid**: Require `durationMs` of sustained violation. Use hysteresis (resolve at 75% when fired at 80%).

## Step 4: Build the Dashboard API

Expose endpoints for querying and pruning.

```typescript
router.get('/series', (_req, res) => {
  res.json({
    count: getSeriesCount(),
    series: getAllSeries().map(s => ({
      name: s.name,
      labels: s.labels,
      valueCount: s.values.length,
    })),
  });
});

router.post('/prune', (req, res) => {
  const hours = Number(req.query.hours) || 24;
  pruneOldData(hours);
  res.json({ success: true });
});
```

### Common Mistakes
- **Mistake**: Returning raw values for high-cardinality metrics.
- **Why it breaks**: Response body becomes 100MB+, crashing the client.
- **How to avoid**: Paginate, aggregate, or require time-range filters.
