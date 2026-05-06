# THINKING: Metrics Collector

## Mental Models

### The Doctor's Vitals Model

Metrics are like a patient's vital signs:
- **Heart rate** = requests per second
- **Blood pressure** = latency percentiles
- **Temperature** = error rate

Just as a doctor checks vitals regularly, engineers monitor metrics continuously. Abnormal vitals trigger alerts. Without vitals, you only know the patient is dead when they stop breathing.

### The Speedometer Model

A car's dashboard has:
- **Speedometer** = current throughput
- **Odometer** = total requests
- **Fuel gauge** = resource utilization
- **Check engine light** = anomaly detection

You don't stare at the dashboard constantly, but you glance at it. When a light comes on, you investigate. Metrics are your application's dashboard.

### The Security Camera Model

Metrics are like security cameras recording to a DVR:
- You record everything (high resolution)
- But you only review recent footage (time window)
- Old footage is automatically deleted (retention policy)
- You can search by camera (metric name) and time (window)

## Hot Path (What Happens on Every Request)

```
POST /metrics { name: "response_time", value: 150, tags: { endpoint: "/api" } }
    |
    v
[Validate input] --invalid?--> Return 400
    |
    v
[Create record with timestamp]
    |
    v
[Append to array in Map]
    |
    v
Return 201
```

O(1) append to array. Very fast.

```
GET /metrics/response_time?windowMs=60000
    |
    v
[Look up metric array] --missing?--> Return 404
    |
    v
[Filter by time window] --BUG: skipped!--> 
    |
    v
[Sort values]
    |
    v
[Compute aggregations]
    |
    v
Return JSON
```

The aggregation path is O(n log n) due to sorting. The time window filter is O(n). Both are necessary for correctness.

## Danger Zones

### 1. No Time Window Filtering (Our Bug)

Without filtering, `getMetrics()` returns ALL historical data:
- Memory grows unbounded
- Query latency increases linearly
- Old data dilutes current metrics

**Scenario after 1 week at 1000 metrics/sec:**
```
Records stored: 604,800,000
Memory: ~10GB
Query time: 30+ seconds
Result: OOM crash
```

### 2. Sorting on Every Query

We sort values on every `getMetrics()` call. For large datasets, this is expensive.

**Mitigation:** Maintain a running sorted structure (e.g., two heaps for median) or pre-compute aggregates incrementally.

### 3. Floating Point Precision

`sum = values.reduce((a, b) => a + b, 0)` can accumulate floating-point errors.

**Example:**
```javascript
let sum = 0;
for (let i = 0; i < 1000000; i++) {
  sum += 0.1;
}
console.log(sum); // 99999.99999999997 (not 100000)
```

**Mitigation:** Use Kahan summation or Welford's algorithm for running statistics.

### 4. Tag Cardinality Explosion

If tags have unbounded unique values (e.g., `userId`), the number of metric series explodes.

**Example:**
```
metric: response_time
tags: { userId: "user-1" }   // series 1
tags: { userId: "user-2" }   // series 2
...
tags: { userId: "user-1000000" } // series 1000000
```

**Mitigation:** Separate high-cardinality dimensions from metrics. Use sampling or pre-aggregation.

### 5. Clock Skew

`Date.now()` is local system time. In distributed systems, clock skew between servers causes inaccurate time windows.

**Mitigation:** Use NTP synchronization. For critical systems, use vector clocks or logical timestamps.

## What-If Game

### What if we don't filter by time window?

Memory grows until OOM. Dashboards show average response time diluted by week-old data. Alerts don't fire because old good data masks current bad data. This is our intentional bug.

### What if we store metrics forever?

Storage cost grows linearly. Query performance degrades. Analytics queries take minutes. The system becomes unusable.

**Solution:** Data retention policies. Prometheus defaults to 15 days. Long-term storage goes to object storage (S3) or specialized TSDBs (InfluxDB, TimescaleDB).

### What if we have 1000 servers reporting metrics?

Each server runs its own metrics collector. Central dashboard needs to aggregate across all servers.

**Solution:** Push metrics to a central collector (StatsD, Prometheus remote write) or pull from each server (Prometheus scrape model).

### What if metrics themselves cause performance issues?

Recording metrics shouldn't slow down the application. But if recording is synchronous and involves network I/O or heavy computation, it becomes a bottleneck.

**Solution:**
- Buffer metrics in memory
- Flush asynchronously
- Use UDP for fire-and-forget (StatsD)
- Sample high-frequency metrics

### What if the metrics collector crashes?

Unflushed metrics are lost. In-memory state disappears.

**Solution:**
- Write-ahead log (WAL) for persistence
- Replicated collectors
- Accept some data loss (metrics are statistical, not transactional)
