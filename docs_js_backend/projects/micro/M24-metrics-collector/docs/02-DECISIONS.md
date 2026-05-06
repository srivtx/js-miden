# DECISIONS: Metrics Collector

## Decision 1: In-Memory Storage vs Time-Series Database

### Option A: In-Memory Arrays (What We Chose)

```typescript
private metrics: Map<string, MetricRecord[]> = new Map();
```

**Pros:**
- Zero latency for writes
- No external dependencies
- Simple to implement and test
- Fast queries (no network I/O)

**Cons:**
- Memory bound
- Data lost on restart
- Not shareable across instances
- No persistent history

### Option B: Time-Series Database (InfluxDB, TimescaleDB)

```typescript
await influx.writePoints([{
  measurement: 'response_time',
  tags: { endpoint: '/api' },
  fields: { value: 150 },
  timestamp: Date.now(),
}]);
```

**Pros:**
- Optimized for time-series queries
- Persistent storage
- Compression (100x smaller than raw)
- Built-in retention policies
- SQL-like query language

**Cons:**
- Infrastructure dependency
- Network latency on every write
- Operational complexity

**Why we chose A:** Micro-project scope. In-memory is appropriate for teaching aggregation concepts. Production systems at scale use Option B.

---

## Decision 2: Sort-on-Query vs Pre-Aggregated Statistics

### Option A: Sort-on-Query (What We Chose)

```typescript
const values = records.map(r => r.value).sort((a, b) => a - b);
const p95 = this.percentile(sortedValues, 0.95);
```

**Pros:**
- Simple to implement
- Exact percentiles
- No incremental state to maintain

**Cons:**
- O(n log n) per query
- Becomes slow with many records

### Option B: Running Statistics (Welford's Algorithm)

```typescript
class RunningStats {
  count = 0;
  mean = 0;
  m2 = 0;
  min = Infinity;
  max = -Infinity;

  add(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
  }
}
```

**Pros:**
- O(1) per write
- O(1) per read
- Numerically stable

**Cons:**
- Doesn't support percentiles (only mean, variance, min, max)
- Can't filter by time window without maintaining multiple windows

### Option C: Histogram Buckets

```typescript
// Pre-defined buckets: 0-10ms, 10-50ms, 50-100ms, 100-500ms, 500ms+
const buckets = [0, 0, 0, 0, 0];

function record(value: number): void {
  if (value < 10) buckets[0]++;
  else if (value < 50) buckets[1]++;
  // ...
}
```

**Pros:**
- O(1) write and read
- Supports approximate percentiles
- Memory bounded (fixed number of buckets)
- What Prometheus uses

**Cons:**
- Approximate percentiles (lossy)
- Requires choosing buckets ahead of time

**Why we chose A:** Exact percentiles with simple code. For production, use C (Prometheus-style histograms) or maintain multiple time windows with B.

---

## Decision 3: Pull vs Push Metrics Model

### Option A: Pull Model (Prometheus-style)

The metrics collector exposes an endpoint. A scraper (Prometheus) periodically fetches metrics.

**Pros:**
- No need to configure where to push
- Scraper controls frequency
- Can detect if target is down (no metrics = problem)

**Cons:**
- Requires HTTP server
- Firewalls may block scraper
- Metrics only as fresh as scrape interval

### Option B: Push Model (StatsD-style)

Applications push metrics to a collector via UDP or HTTP.

**Pros:**
- Works behind firewalls
- Immediate (no scrape delay)
- Simpler for short-lived processes (serverless)

**Cons:**
- Need to configure collector address
- Collector becomes a dependency
- UDP can lose metrics

**Why we chose A (HTTP API):** This project implements a pull-style API (`GET /metrics/:name`). The recording endpoint (`POST /metrics`) is push-style. In practice, most modern systems use both.

---

## Decision 4: Tags as Object vs String Encoding

### Option A: Object Tags (What We Chose)

```typescript
interface MetricRecord {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}
```

**Pros:**
- Structured and type-safe
- Easy to filter/query
- Human-readable

**Cons:**
- Higher memory usage than string encoding
- Key ordering issues for equality

### Option B: String Encoding (Prometheus-style)

```typescript
// Encode as: "name{endpoint=\"/api\",method=\"GET\"}"
const seriesKey = `${name}{${Object.entries(tags).map(([k,v]) => `${k}="${v}"`).join(',')}}`;
```

**Pros:**
- Single string key for Map lookup
- Standard format (Prometheus)
- Lower memory for simple cases

**Cons:**
- Parsing required for filtering
- Escaping special characters
- Less structured

**Why we chose A:** Object tags are easier to work with in TypeScript. For production Prometheus compatibility, use B.
