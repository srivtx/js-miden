# Architecture: Metrics Collector

## Components

### MetricRecord
- `name`: Metric identifier
- `value`: Numeric measurement
- `tags`: Key-value labels
- `timestamp`: When recorded

### MetricsCollector
- `metrics`: Map<name, MetricRecord[]>
- Records metrics in memory
- Computes aggregations on read

### Aggregation Engine
- Count, sum, average
- Min, max
- Percentiles (p95, p99)

### Express Routes
- `POST /metrics` - Record a metric
- `GET /metrics/:name` - Read aggregated metrics
- `GET /metrics` - Read all metrics

## Data Flow

1. Client POST /metrics with name, value, tags
2. Collector creates MetricRecord with timestamp
3. Appends to array for that metric name
4. Client GET /metrics/:name?windowMs=60000
5. Filter records by timestamp > now - windowMs
6. Compute aggregations on filtered set

## Time Windows

```
const cutoff = Date.now() - windowMs;
const recent = records.filter(r => r.timestamp > cutoff);
```

Without time windows, memory grows unbounded.

## Percentile Calculation

```
// Sort values, then pick index
const sorted = values.sort((a, b) => a - b);
const p95Index = Math.ceil(sorted.length * 0.95) - 1;
const p95 = sorted[Math.max(0, p95Index)];
```

## Memory Management

Options:
1. **Sliding window**: Only keep last N minutes
2. **Fixed buckets**: Pre-allocate time buckets
3. **Ring buffer**: Overwrite old data
4. **External storage**: Send to Prometheus/TSDB
