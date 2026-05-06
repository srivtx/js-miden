# HOW: Metrics Collector

## Implementation Steps

### Step 1: Define Data Structures

```typescript
interface MetricRecord {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}
```

### Step 2: Record with Time Window

```typescript
record(name: string, value: number, tags = {}): void {
  const record: MetricRecord = {
    name, value, tags,
    timestamp: Date.now(),
  };

  if (!this.metrics.has(name)) {
    this.metrics.set(name, []);
  }

  this.metrics.get(name)!.push(record);

  // Cleanup old records to prevent unbounded growth
  this.cleanup(name);
}
```

### Step 3: Filter by Time Window

```typescript
getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
  const cutoff = windowMs ? Date.now() - windowMs : 0;
  let records = this.metrics.get(name) || [];

  // CRITICAL FIX: Filter by time window
  records = records.filter(r => r.timestamp > cutoff);

  if (records.length === 0) return null;

  const values = records.map(r => r.value).sort((a, b) => a - b);
  // ... compute aggregations
}
```

### Step 4: Compute Percentiles

```typescript
private percentile(sorted: number[], p: number): number {
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}

// Usage:
p95: this.percentile(values, 0.95),
p99: this.percentile(values, 0.99),
```

### Step 5: Prevent Overflow

```typescript
// For high-volume systems, use Welford's algorithm
// to compute running average without overflow:

class RunningStats {
  count = 0;
  mean = 0;
  m2 = 0;

  add(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  get average(): number {
    return this.mean;
  }

  get variance(): number {
    return this.count > 1 ? this.m2 / (this.count - 1) : 0;
  }
}
```

### Step 6: Cleanup Old Data

```typescript
private cleanup(name: string, maxAgeMs: number = 300000): void {
  const cutoff = Date.now() - maxAgeMs;
  const records = this.metrics.get(name);
  if (records) {
    const filtered = records.filter(r => r.timestamp > cutoff);
    this.metrics.set(name, filtered);
  }
}
```

## Best Practices

- Always filter by time window
- Pre-allocate arrays when possible
- Use running statistics for high volume
- Export to external TSDB for long-term storage
- Sample high-cardinality metrics
