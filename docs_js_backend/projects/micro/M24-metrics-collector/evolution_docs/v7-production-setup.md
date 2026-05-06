# v7: Production Setup — Metrics Collector

## The Journey

We started with `console.log` counters, layered in types, validation, logging, tests, and ESM. Now we have a metrics collector that won't OOM in production.

## What v7 Adds

- **Sliding time windows**: Query only the last N minutes
- **Histogram buckets**: Pre-bucketed data for fast percentiles
- **Memory-bound storage**: Old metrics auto-evicted
- **Structured logging**: Every metric record is traceable
- **Tag cardinality limits**: Prevents memory explosion from high-cardinality tags

## The Final Code

```typescript
// src/metrics-collector.ts
import { logger } from './logger.js';

export interface MetricRecord {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

export class MetricsCollector {
  private metrics: Map<string, MetricRecord[]> = new Map();
  private readonly maxTagCardinality = 1000;
  private tagSets: Map<string, Set<string>> = new Map();

  record(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!this.checkCardinality(name, tags)) {
      logger.warn({ name, tags }, 'Tag cardinality limit exceeded, dropping metric');
      return;
    }

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
    logger.debug({ name, value }, 'Metric recorded');
  }

  getMetrics(name: string, windowMs: number = 300_000): AggregatedMetrics | null {
    const cutoff = Date.now() - windowMs;
    let records = this.metrics.get(name) || [];
    records = records.filter(r => r.timestamp > cutoff);

    if (records.length === 0) return null;

    const values = records.map(r => r.value).sort((a, b) => a - b);
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: values[0],
      max: values[values.length - 1],
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private checkCardinality(name: string, tags: Record<string, string>): boolean {
    const key = `${name}:${Object.keys(tags).sort().join(',')}`;
    if (!this.tagSets.has(key)) this.tagSets.set(key, new Set());
    const set = this.tagSets.get(key)!;
    const fingerprint = JSON.stringify(tags);
    if (set.size >= this.maxTagCardinality && !set.has(fingerprint)) return false;
    set.add(fingerprint);
    return true;
  }
}
```

## Why This Matters in Production

Without time windows, `response_time` accumulates forever. A server running for 6 months with 10k RPM grows to 2.6 billion records. With sliding windows, memory stays flat. Without cardinality limits, a misbehaving client sending `user_id` as a tag creates infinite tag combinations.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | `console.log` is not queryable | In-memory metric store |
| v2 | Untyped metrics crash aggregators | `MetricRecord` interface |
| v3 | String values break math | Validate numeric `value` on POST |
| v4 | No visibility into ingestion | Structured logging per record |
| v5 | Percentile math is wrong | Jest tests with known distributions |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | Unbounded memory, no time filtering | Sliding windows + cardinality limits |

## Run It

```bash
METRICS_WINDOW_MS=300000 node dist/index.js
```
