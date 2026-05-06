# The Bugs

## Bug 1: Cardinality Explosion

### How to Introduce It
Remove any limit on the number of unique label combinations per metric:

```typescript
export function recordMetric(name, type, value, labels = {}) {
  const key = seriesKey(name, labels);
  let ts = timeSeriesMap.get(key);
  if (!ts) {
    ts = { name, type, labels, values: [] };
    timeSeriesMap.set(key, ts); // No limit check!
  }
  ts.values.push({ timestamp: Date.now(), value });
}
```

### Why It Exists
The developer assumed labels would only be low-cardinality dimensions like `method` and `status`. They didn't consider that a misconfigured client could send `requestId`.

### Symptoms You'll See
- Memory usage climbs linearly.
- `GET /dashboard/series` slows to a crawl.
- Process crashes with OOM.

### How to Reproduce
```bash
for i in $(seq 1 100000); do
curl -X POST http://localhost:3000/metrics \
  -d '{"name":"x","type":"counter","value":1,"labels":{"id":"'$i'"}}'
done
```

### The Fix
```typescript
const CARDINALITY_LIMIT = 10000;
const metricCardinality = new Map<string, number>();

function recordMetric(name, type, value, labels = {}) {
  const key = seriesKey(name, labels);
  if (!timeSeriesMap.has(key)) {
    const current = metricCardinality.get(name) || 0;
    if (current >= CARDINALITY_LIMIT) {
      console.warn(`Cardinality limit exceeded for ${name}`);
      return; // Drop the metric
    }
    metricCardinality.set(name, current + 1);
  }
  // ... rest of logic
}
```

### Why the Fix Works
By tracking unique series per metric name, we cap memory growth. Excess series are dropped with a warning, preventing OOM.

### Real-World Impact
In 2021, a major cloud provider's metrics agent OOM'd due to a `traceId` label, taking down a control plane.

## Bug 2: No Retention Policy

### How to Introduce It
Never prune old data. The `pruneOldData()` function exists but is never called automatically.

### Why It Exists
The developer planned to add a cron job later but forgot. "We'll add retention in v2."

### Symptoms You'll See
- Memory grows by ~50MB/day for a moderately active service.
- After 2 weeks, the container is killed by Kubernetes OOMKiller.

### The Fix
```typescript
setInterval(() => {
  const retentionHours = Number(process.env.RETENTION_HOURS) || 24;
  pruneOldData(retentionHours);
}, 60_000);
```

### Why the Fix Works
A background job continuously removes data older than the retention window. Memory usage plateaus instead of growing forever.

## Bug 3: Alert Flapping

### How to Introduce It
Toggle alert state immediately on every threshold check without requiring duration or hysteresis.

### Why It Exists
The developer thought "if CPU > 80%, page me." They didn't consider that CPU naturally oscillates around thresholds.

### Symptoms You'll See
- 50 pages/hour for the same alert.
- On-call engineers disable the alert entirely.
- Real incidents are missed because alerts are ignored.

### The Fix
```typescript
if (triggered) {
  if (!state) {
    alertStates.set(rule.id, { ruleId: rule.id, active: false, firstTriggeredAt: now });
  } else if (!state.active && now - state.firstTriggeredAt >= rule.durationMs) {
    state.active = true;
    state.triggeredAt = now;
    pageOnCall(rule);
  }
} else {
  // Hysteresis: resolve only if below threshold - 5%
  if (state?.active && currentValue < rule.threshold * 0.95) {
    state.active = false;
    state.resolvedAt = now;
  }
}
```

### Why the Fix Works
- `durationMs` ensures the condition is sustained before paging.
- Hysteresis (95% of threshold for resolve) prevents oscillation.
