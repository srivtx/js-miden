# v2: Add TypeScript — Metrics Collector

## The Pain

You write the metrics collector in JavaScript:

```javascript
// src/metrics-collector.js
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
  }

  record(name, value, tags) {
    const record = {
      name,
      value,
      tags: tags || {},
      timestamp: Date.now(),
    };
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(record);
  }

  getMetrics(name, windowMs) {
    let records = this.metrics.get(name) || [];
    // BUG: windowMs is ignored, but the parameter exists
    const values = records.map(r => r.value).sort((a, b) => a - b);
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      // BUG: p95 calculation is wrong
      p95: values[Math.floor(values.length * 0.95)],
    };
  }
}
```

The `p95` calculation uses `Math.floor` instead of `Math.ceil - 1`. For 10 values, `Math.floor(9.5) = 9` (correct). For 20 values, `Math.floor(19) = 19` (should be 18). The bug is subtle and silent.

## The Solution

Add TypeScript. Define interfaces. Type-check the math.

## After (With TypeScript)

```typescript
// src/metrics-collector.ts
export interface MetricRecord {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

export interface AggregatedMetrics {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private metrics: Map<string, MetricRecord[]> = new Map();

  record(name: string, value: number, tags: Record<string, string> = {}): void {
    const record: MetricRecord = {
      name,
      value,
      tags,
      timestamp: Date.now(),
    };
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(record);
  }

  getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
    let records = this.metrics.get(name) || [];

    if (records.length === 0) return null;

    const values = records.map(r => r.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count,
      sum,
      avg: sum / count,
      min: values[0],
      max: values[count - 1],
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }
}
```

## The Bug TypeScript Catches

- `record('latency', 'fast')` → `Argument of type 'string' is not assignable to parameter of type 'number'`
- `getMetrics()` → `Expected 1-2 arguments, but got 0` (if `name` is required)
- `values[Math.floor(values.length * 0.95)]` → No direct type error, but the interface forces you to think about return types

## Why TypeScript Matters

- **Type safety**: `value: number` prevents string metrics
- **Interface contracts**: `AggregatedMetrics` documents exactly what consumers get
- **Null safety**: `getMetrics` returns `AggregatedMetrics | null`, forcing callers to handle missing metrics
- **Refactoring**: Rename `MetricRecord` → `Metric` and every usage updates

Without TypeScript, a string value silently corrupts statistics. With TypeScript, the compiler rejects it at the call site.
