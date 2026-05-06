# MD14 Monitoring Stack — v7 Production Setup

## Overview
The final step turns the basic metric recorder into a production monitoring stack. We add cardinality limits, automatic retention pruning, alert hysteresis, histogram support, and Docker deployment.

## Changes
- **Cardinality Limits**: Hard cap (e.g., 10K series per metric). Excess series are dropped with a warning.
- **Retention Policy**: Background `setInterval` prunes samples older than `RETENTION_HOURS`.
- **Alert Hysteresis**: Alerts require `durationMs` of sustained violation and resolve at 95% of threshold to prevent flapping.
- **Histograms**: Bucketed latency distributions for p50/p99 computation.
- **Dashboard API**: `GET /dashboard/series` with pagination and time-range filters.
- **Deployment**: `Dockerfile` and `docker-compose.yml`.

## Code Snippet
```typescript
// src/services/metricStore.ts (production excerpt)
const CARDINALITY_LIMIT = 10_000;
const metricCardinality = new Map<string, number>();

export function recordMetric(name: string, type: MetricType, value: number, labels: Labels = {}, timestamp = Date.now()) {
  const key = seriesKey(name, labels);
  if (!timeSeriesMap.has(key)) {
    const current = metricCardinality.get(name) || 0;
    if (current >= CARDINALITY_LIMIT) {
      logger.warn({ metric: name }, 'cardinality_limit_exceeded');
      return;
    }
    metricCardinality.set(name, current + 1);
  }
  // ... push value ...
}

// Background pruning
setInterval(() => {
  pruneOldData(Number(process.env.RETENTION_HOURS) || 24);
}, 60_000);
```

## Rationale
- Cardinality limits prevent OOM from mislabeled metrics (e.g., `requestId` as a label).
- Retention pruning bounds memory usage; without it, the process is killed by Kubernetes OOMKiller.
- Hysteresis + duration prevent pager fatigue and alert storms.

## Trade-offs
- In-memory store loses data on crash; production should use Prometheus remote-write or a WAL.
- Histograms add memory overhead per bucket series.

## References
- `docs/02-DECISIONS.md` — why in-memory map, counters/gauges/histograms, pull model.
- `docs/06-BUGS.md` — cardinality explosion, no retention, alert flapping.
- `docs/03-CONCEPTS.md` — cardinality, histograms, alert flapping, retention policy.
