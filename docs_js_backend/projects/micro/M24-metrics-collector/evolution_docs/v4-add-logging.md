# v4: Add Logging — Metrics Collector

## The Pain

Your API latency spikes to 5 seconds at 2 AM. You have no idea why. The metrics collector is running, but you can't see what it recorded. You check `console.log` — there's nothing. You check the application logs — they don't mention metrics.

You restart the service. The metrics are gone (in-memory storage). The incident is over. You will never know what happened.

## The Solution

Add structured logging for every metric record and aggregation query.

## Before (No Logs)

```typescript
// src/metrics-collector.ts
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
  // ... aggregation ...
  return { count, sum, avg, min, max, p95, p99 };
}
```

## After (With Logging)

```typescript
// src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

```typescript
// src/metrics-collector.ts
import { logger } from './logger.js';

record(name: string, value: number, tags: Record<string, string> = {}): void {
  const record: MetricRecord = {
    name,
    value,
    tags,
    timestamp: Date.now(),
  };
  if (!this.metrics.has(name)) {
    this.metrics.set(name, []);
    logger.info({ name }, 'New metric series created');
  }
  this.metrics.get(name)!.push(record);
  logger.debug({ name, value, tags }, 'Metric recorded');
}

getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
  const cutoff = windowMs ? Date.now() - windowMs : 0;
  let records = this.metrics.get(name) || [];
  records = records.filter(r => r.timestamp > cutoff);

  if (records.length === 0) {
    logger.debug({ name, windowMs }, 'No metrics found for query');
    return null;
  }

  const values = records.map(r => r.value).sort((a, b) => a - b);
  const result = {
    count: values.length,
    sum: values.reduce((a, b) => a + b, 0),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: values[0],
    max: values[values.length - 1],
    p95: this.percentile(values, 0.95),
    p99: this.percentile(values, 0.99),
  };

  logger.info({ name, windowMs, count: result.count, p95: result.p95 }, 'Metrics aggregated');
  return result;
}
```

## What the Logs Look Like

```json
{"level":30,"time":1715200000000,"name":"response_time","msg":"New metric series created"}
{"level":20,"time":1715200001000,"name":"response_time","value":150,"tags":{"endpoint":"/api"},"msg":"Metric recorded"}
{"level":20,"time":1715200002000,"name":"response_time","value":5000,"tags":{"endpoint":"/api"},"msg":"Metric recorded"}
{"level":30,"time":1715200003000,"name":"response_time","windowMs":300000,"count":2,"p95":5000,"msg":"Metrics aggregated"}
```

## Why Logging Matters

- **Incident response**: You see `value: 5000` and know exactly when the spike happened
- **Debugging**: "No metrics found for query" tells you the time window is too short
- **Cardinality alerting**: Log `count` of unique tag combinations to detect runaway cardinality
- **Audit**: Prove that a metric was recorded (or wasn't)

Without logs, your metrics are a black box. With logs, every record and query is observable.
