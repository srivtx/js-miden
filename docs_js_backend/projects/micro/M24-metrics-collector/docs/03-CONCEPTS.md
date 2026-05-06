# CONCEPTS: Metrics Collector

## Concept 1: Time-Series Data

### WHAT

Time-series data is a sequence of data points indexed in time order. Each point represents a measurement at a specific moment.

### WHY

Most metrics are naturally time-series: response times, request counts, error rates. Understanding time-series patterns lets you detect trends, seasonality, and anomalies.

### HOW

```typescript
interface MetricRecord {
  name: string;        // What we measured (e.g., "response_time")
  value: number;       // The measurement (e.g., 150ms)
  tags: Record<string, string>; // Dimensions (e.g., { endpoint: "/api" })
  timestamp: number;   // When (Unix epoch ms)
}

// Example time series:
// 10:00:00 -> 150ms
// 10:00:01 -> 148ms
// 10:00:02 -> 2000ms  <-- anomaly!
// 10:00:03 -> 152ms
```

### WRONG vs RIGHT

**WRONG: No timestamp**
```typescript
// When did this happen? We don't know.
const values = [150, 148, 2000, 152];
```

**RIGHT: Timestamped records**
```typescript
// We can filter by time, detect trends, correlate with events
const records = [
  { value: 150, timestamp: 1714980000000 },
  { value: 148, timestamp: 1714980001000 },
  { value: 2000, timestamp: 1714980002000 },
];
```

---

## Concept 2: Percentiles

### WHAT

A percentile is the value below which a given percentage of observations fall. P95 = the value below which 95% of observations fall.

### WHY

Averages lie. If 95% of requests take 10ms but 5% take 10s, the average is ~510ms. The P95 (10ms) tells you what most users experience. The P99 (10s) tells you about the worst cases.

### HOW

```typescript
private percentile(sortedValues: number[], p: number): number {
  const index = Math.ceil(sortedValues.length * p) - 1;
  return sortedValues[Math.max(0, index)];
}

// Example: [10, 20, 30, 40, 50]
// P50 (median): index = ceil(5 * 0.5) - 1 = 2 -> value = 30
// P95: index = ceil(5 * 0.95) - 1 = 4 -> value = 50
```

### WRONG vs RIGHT

**WRONG: Using average only**
```typescript
// Average of [10, 10, 10, 10, 10000] = 2008ms
// "Our API averages 2 seconds" -- technically true, misleading
```

**RIGHT: Using percentiles**
```typescript
// P50 = 10ms (most users are fast)
// P99 = 10000ms (some users are very slow)
// Now we know there's a tail latency problem
```

---

## Concept 3: Time Windows

### WHAT

A time window is a sliding interval that includes only data points within a specified duration from the present.

### WHY

Old data is irrelevant for current monitoring. A 5-minute window shows "right now." A 24-hour window shows "today." Without windows, metrics are diluted by historical data.

### HOW

```typescript
getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
  const cutoff = windowMs ? Date.now() - windowMs : 0;
  let records = this.metrics.get(name) || [];

  // Filter by time window
  records = records.filter(r => r.timestamp > cutoff);

  if (records.length === 0) return null;
  // ... compute aggregations
}
```

### WRONG vs RIGHT

**WRONG: All historical data**
```typescript
// At 10:05, querying "last 5 minutes" but getting data from 10:00 yesterday
// Average is diluted by old, irrelevant data
// Alerts don't fire because old good data masks current problems
```

**RIGHT: Filtered window**
```typescript
// Only data from 10:00 to 10:05
// Accurate current state
// Alerts fire immediately when thresholds are breached
```

---

## Concept 4: Memory Management

### WHAT

Preventing unbounded memory growth by evicting old data.

### WHY

Servers run for months. At 1000 metrics/second, that's 2.6 billion metrics per month. Without eviction, the process will run out of memory and crash.

### HOW

```typescript
// Automatic eviction during recording
record(name: string, value: number, tags: Record<string, string> = {}): void {
  // ... record metric ...
  
  // Periodically clean old metrics
  this.cleanupOldMetrics(name, this.defaultRetentionMs);
}

private cleanupOldMetrics(name: string, retentionMs: number): void {
  const cutoff = Date.now() - retentionMs;
  const records = this.metrics.get(name);
  if (records) {
    const filtered = records.filter(r => r.timestamp > cutoff);
    this.metrics.set(name, filtered);
  }
}
```

### WRONG vs RIGHT

**WRONG: Store forever**
```typescript
// Memory grows linearly with uptime
// Process crashes after days or weeks
// No cleanup logic at all
```

**RIGHT: Time-based eviction**
```typescript
// Old metrics automatically removed
// Memory stays bounded
// Process runs indefinitely
```
