# WRONG vs RIGHT: Metrics Collector

## Time Windows

### WRONG: Return All Historical Data

```typescript
getMetrics(name: string): AggregatedMetrics | null {
  let records = this.metrics.get(name) || [];
  // No filtering - returns everything!
  // ...
}
```

**Why it's wrong**: Memory grows unbounded. After 1 day, querying returns millions of records. Latency increases linearly.

### RIGHT: Filter by Time Window

```typescript
getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
  const cutoff = windowMs ? Date.now() - windowMs : 0;
  let records = this.metrics.get(name) || [];
  records = records.filter(r => r.timestamp > cutoff);
  // ...
}
```

**Why it's right**: Bounded memory usage. Query returns relevant data only.

---

## Average Calculation

### WRONG: Simple Sum/Count with Overflow Risk

```typescript
const sum = values.reduce((a, b) => a + b, 0);
const avg = sum / count;
```

**Why it's wrong**: With millions of values, sum can overflow Number.MAX_SAFE_INTEGER. Also accumulates floating-point error.

### RIGHT: Welford's Algorithm

```typescript
class RunningStats {
  count = 0;
  mean = 0;

  add(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
  }
}
```

**Why it's right**: Numerically stable. No overflow risk. Single pass.

---

## Memory Management

### WRONG: Keep Everything Forever

```typescript
record(name: string, value: number): void {
  this.metrics.get(name)!.push({ name, value, timestamp: Date.now() });
}
```

**Why it's wrong**: Memory grows until OOM crash.

### RIGHT: Automatic Cleanup

```typescript
record(name: string, value: number): void {
  const records = this.metrics.get(name)!;
  records.push({ name, value, timestamp: Date.now() });

  // Drop old records
  const cutoff = Date.now() - this.maxAgeMs;
  const firstValid = records.findIndex(r => r.timestamp > cutoff);
  if (firstValid > 0) {
    records.splice(0, firstValid);
  }
}
```

**Why it's right**: Old data is automatically purged.

---

## Percentile Accuracy

### WRONG: Approximate Percentiles

```typescript
// Using average as percentile approximation
const p95 = avg + stddev * 2;
```

**Why it's wrong**: Assumes normal distribution. Real latency is often bimodal or has long tails.

### RIGHT: Sort and Index

```typescript
const sorted = values.sort((a, b) => a - b);
const p95Index = Math.ceil(sorted.length * 0.95) - 1;
const p95 = sorted[Math.max(0, p95Index)];
```

**Why it's right**: Exact percentile from actual data.
