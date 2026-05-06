# Concepts Explained

## Concept: Time-Series Data

### What Is It?
A sequence of data points indexed in time order. Each point has a timestamp and a value.

### Why Do We Use It?
Metrics are inherently temporal. "What was CPU at 14:03?" requires time-indexed storage.

### How Does It Work?
```typescript
interface TimeSeries {
  name: string;      // e.g., "cpu_usage"
  labels: Labels;    // e.g., { host: "srv-1" }
  values: Array<{ timestamp: number; value: number }>;
}
```

### Common Misconceptions
- **Wrong way**: Store metrics in a relational table with one row per sample. Queries become slow.
- **Right way**: Group by series key (name + labels), store values as arrays.

## Concept: Cardinality

### What Is It?
The number of unique time series. If `http_requests_total` has labels `method` (3 values) and `status` (5 values), cardinality = 3 × 5 = 15.

### Why Is It Dangerous?
If `userId` (1M values) is added, cardinality becomes 3 × 5 × 1M = 15M. Each series has overhead (~1KB). 15M × 1KB = 15GB RAM.

### Real-World Impact
In 2021, a major cloud provider had an outage because a team added `traceId` to a metric label. Cardinality exploded to billions. The monitoring system OOM'd and took down the control plane.

## Concept: Histograms

### What Is It?
A metric that counts observations into buckets. Each bucket has an upper bound.

### Why Do We Use It?
To compute percentiles (p50, p99) without storing every individual value.

### Code Example
```typescript
// Recording a request duration
recordHistogram('request_duration_ms', 145, { route: '/api/users' });

// Buckets: [10, 50, 100, 200, 500, 1000, +Inf]
// Result: buckets {10:0, 50:0, 100:0, 200:1, 500:1, 1000:1, +Inf:1}
```
