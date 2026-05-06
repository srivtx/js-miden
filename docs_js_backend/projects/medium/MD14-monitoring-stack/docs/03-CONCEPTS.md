# Concepts Explained

## Concept: Time-Series Data

### WHAT Is It?
A sequence of data points indexed in time order. Each point has a timestamp and a value.

### WHY Do We Use It?
Metrics are inherently temporal. "What was CPU at 14:03?" requires time-indexed storage.

### HOW Does It Work?
```typescript
interface TimeSeries {
  name: string;      // e.g., "cpu_usage"
  labels: Labels;    // e.g., { host: "srv-1" }
  values: Array<{ timestamp: number; value: number }>;
}
```

### Common Misconceptions
- **WRONG**: Store metrics in a relational table with one row per sample. Queries become slow.
- **RIGHT**: Group by series key (name + labels), store values as arrays.

---

## Concept: Cardinality

### WHAT Is It?
The number of unique time series. If `http_requests_total` has labels `method` (3 values) and `status` (5 values), cardinality = 3 × 5 = 15.

### WHY Is It Dangerous?
If `userId` (1M values) is added, cardinality becomes 3 × 5 × 1M = 15M. Each series has overhead (~1KB). 15M × 1KB = 15GB RAM.

### Real-World Impact
In 2021, a major cloud provider had an outage because a team added `traceId` to a metric label. Cardinality exploded to billions. The monitoring system OOM'd and took down the control plane.

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| High-cardinality labels (`userId`, `requestId`). | Low-cardinality labels (`method`, `status`, `region`). |
| No cardinality limits per metric name. | Hard cap (e.g., 10K series per metric). Drop with warning. |

---

## Concept: Histograms

### WHAT Is It?
A metric that counts observations into buckets. Each bucket has an upper bound.

### WHY Do We Use It?
To compute percentiles (p50, p99) without storing every individual value.

### HOW Does It Work?
```typescript
// Recording a request duration
recordHistogram('request_duration_ms', 145, { route: '/api/users' });

// Buckets: [10, 50, 100, 200, 500, 1000, +Inf]
// Result: buckets {10:0, 50:0, 100:0, 200:1, 500:1, 1000:1, +Inf:1}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Storing every raw latency value. | Bucketing into histograms. |
| Linear buckets (1ms, 2ms, 3ms...). | Exponential buckets (10ms, 50ms, 100ms...). |

---

## Concept: Alert Flapping

### WHAT Is It?
An alert that repeatedly triggers and resolves due to metric oscillation around a threshold.

### WHY Does It Happen?
Without hysteresis or duration requirements, a metric crossing 80% → 79% → 81% → 78% pages the on-call engineer 4 times.

### HOW Does It Work?
```typescript
// WRONG: Immediate toggle
if (currentValue > threshold) pageOnCall();
else resolveAlert();

// RIGHT: Duration + hysteresis
if (currentValue > threshold && sustainedFor > durationMs) pageOnCall();
if (currentValue < threshold * 0.95) resolveAlert();
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Firing on every threshold crossing. | Requiring sustained violation for `durationMs`. |
| Resolving at the same threshold. | Hysteresis: resolve at 75% when fired at 80%. |

---

## Concept: Retention Policy

### WHAT Is It?
Automatically deleting metric samples older than a configured time window.

### WHY Do We Use It?
In-memory storage is finite. Without retention, memory grows until the process crashes.

### HOW Does It Work?
```typescript
function pruneOldData(retentionHours: number) {
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
  for (const ts of timeSeriesMap.values()) {
    ts.values = ts.values.filter(v => v.timestamp >= cutoff);
  }
}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| No pruning. | Background job pruning every minute. |
| Manual pruning via admin endpoint. | Automatic pruning + TTL on every insert. |
