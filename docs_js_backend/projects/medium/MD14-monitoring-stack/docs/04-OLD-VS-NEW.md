# Old Ways vs New Ways (2025)

## Pattern: Metric Collection

### The Old Way (2015-2020)
```javascript
// StatsD / Graphite era
const client = require('node-statsd');
const statsd = new client({ host: 'localhost' });

statsd.increment('api.requests'); // UDP fire-and-forget
statsd.timing('api.latency', 145); // ms
```
**Why we did it:** UDP was "free" — no blocking, no backpressure.
**Why it's wrong now:** UDP drops packets silently. You lose data during congestion. No structured labels (tags were string-encoded).

### The New Way (2025)
```typescript
import { recordMetric } from './metricStore.js';

recordMetric('http_requests_total', 'counter', 1, {
  method: 'GET',
  status: '200',
  route: '/api/users',
});
```
**Why it's better:** Structured labels, type-safe, explicit backpressure handling, histogram support.

### Migration Path
1. Replace StatsD calls with typed metric functions.
2. Add label validation to prevent cardinality explosion.
3. Use pull-based scraping (Prometheus) or push with batching (OTLP).

## Pattern: Alerting

### The Old Way
```bash
# Nagios / Cron-based
*/5 * * * * /usr/local/bin/check_cpu.sh || page_oncall
```
**Why it's wrong:** No context, no history, flaps constantly.

### The New Way
```typescript
const rule: AlertRule = {
  metricName: 'cpu_usage',
  condition: 'gt',
  threshold: 80,
  durationMs: 300_000, // Must be > 80% for 5 minutes
  severity: 'critical',
};
```
**Why it's better:** Duration requirement prevents flapping. Labels allow routing to the right team.

## Pattern: Storage

### The Old Way
Round-robin databases (RRDtool) with fixed-size files.
**Why it's wrong:** Fixed resolution, hard to query ad-hoc.

### The New Way
Columnar time-series DBs (ClickHouse, TimescaleDB, VictoriaMetrics).
**Why it's better:** Compression ratios of 10:1 or better. SQL-like querying. Dynamic retention.
