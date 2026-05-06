# 06 - Analytics Service

## WHAT

The Analytics Service collects, aggregates, and serves metrics for developer dashboards. It transforms raw usage events into actionable insights.

**Responsibilities:**
- Collect metric events from the Gateway
- Aggregate metrics by API, endpoint, and time window
- Calculate response time percentiles (p50, p95, p99)
- Compute error rates and availability
- Serve dashboard data via API

## WHY

### Why a Separate Analytics Service?

Analytics queries are fundamentally different from operational queries:
- **Operational (Usage Service):** "What's the current count for key X?" -> O(1)
- **Analytics:** "What's the p99 response time for endpoint Y over the last 30 days?" -> O(n)

Separating them prevents expensive analytics queries from impacting API gateway performance.

### Why Pre-Aggregate?

Raw event data grows unbounded. 1M requests/day = 30M records/month. Dashboards can't scan 30M rows per request.

Pre-aggregation reduces this to:
- 1 record per endpoint per hour = ~720 records/month per endpoint
- Dashboard queries become millisecond-fast

## HOW

### Data Model

**Raw Events (short retention):**
```typescript
interface AnalyticsEvent {
  timestamp: Date;
  apiId: string;
  endpoint: string;
  method: string;
  responseTimeMs: number;
  statusCode: number;
}
```

**Pre-Aggregated (long retention):**
```typescript
interface HourlyAggregate {
  apiId: string;
  endpoint: string;
  hour: Date;              // Truncated to hour
  requestCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
  errorCount: number;
  responseTimeHistogram: number[]; // For percentile calculation
}
```

### Aggregation Pipeline

```
Raw Events (Kafka/Redis Stream)
    |
    v
+-------------+
|  Flusher    |  (runs every minute)
+-------------+
    |
    v
Hourly Buckets (Redis)
    |
    v
+-------------+
|  Compactor  |  (runs daily)
+-------------+
    |
    v
Daily Summaries (PostgreSQL)
```

### Dashboard Query

```typescript
// Get last 24 hours of metrics for an API
async function getDashboard(apiId: string, hours: number) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const metrics = await db.query(`
    SELECT 
      endpoint,
      SUM(request_count) as total_requests,
      AVG(avg_response_time) as avg_response_time,
      SUM(error_count)::float / SUM(request_count) as error_rate
    FROM hourly_aggregates
    WHERE api_id = ? AND hour >= ?
    GROUP BY endpoint
  `, [apiId, cutoff]);
  
  return metrics;
}
```

## WRONG vs RIGHT

### WRONG: Querying Raw Events for Dashboards

```typescript
// WRONG: Scanning all events every dashboard load
app.get('/dashboard/:apiId', async (req, res) => {
  const events = await db.query(`
    SELECT * FROM usage_events 
    WHERE api_id = ? AND timestamp > NOW() - INTERVAL '24 hours'
  `, [req.params.apiId]);
  
  // Calculate aggregates in JavaScript
  const metrics = calculateAggregates(events); // O(n) on millions of rows!
  res.json(metrics);
});
```

**Why Wrong:** Dashboard loads in 5-30 seconds. Database CPU spikes. Can't scale past ~1M events/day.

### RIGHT: Pre-Aggregated Dashboard Data

```typescript
// RIGHT: Read from pre-computed aggregates
app.get('/dashboard/:apiId', async (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  // O(number of endpoints) regardless of request volume
  const metrics = await db.query(`
    SELECT endpoint, total_requests, avg_response_time, error_rate
    FROM daily_endpoint_summaries
    WHERE api_id = ? AND day >= ?
  `, [req.params.apiId, cutoff]);
  
  res.json(metrics);
});
```

**Why Right:** Dashboard loads in <50ms even with 100M+ events. Database load is constant.

### WRONG: Blocking Gateway for Analytics

```typescript
// WRONG: Gateway waits for analytics to record
app.all('/:apiId/*', async (req, res) => {
  const response = await proxyRequest(target, req);
  
  // Blocking call!
  await analyticsClient.post('/event', {
    apiId: req.params.apiId,
    responseTimeMs: Date.now() - startTime,
    // ...
  });
  
  res.json(response);
});
```

**Why Wrong:** Analytics service latency adds directly to API response time. If Analytics is down, APIs fail.

### RIGHT: Async Event Ingestion

```typescript
// RIGHT: Fire-and-forget with local buffer
app.all('/:apiId/*', async (req, res) => {
  const response = await proxyRequest(target, req);
  
  // Non-blocking: Add to local buffer
  analyticsBuffer.push({
    apiId: req.params.apiId,
    responseTimeMs: Date.now() - startTime,
    // ...
  });
  
  res.json(response);
});

// Flush buffer every 5 seconds
setInterval(async () => {
  const batch = analyticsBuffer.splice(0, 1000);
  if (batch.length > 0) {
    await analyticsClient.post('/batch', { events: batch });
  }
}, 5000);
```

**Why Right:** Zero impact on API latency. Batch ingestion is more efficient. Buffer survives transient Analytics outages.

### WRONG: No Data Retention Policy

```typescript
// WRONG: Keeping raw events forever
// Table grows without bound
// 1 year = 365M rows for 1M req/day
```

**Why Wrong:** Infinite storage growth. Queries get slower over time. Backups take forever.

### RIGHT: Tiered Retention

```typescript
// Raw events: 7 days
// Hourly aggregates: 90 days
// Daily aggregates: 2 years
// Monthly aggregates: forever

async function runRetentionPolicy() {
  await db.query(`DELETE FROM raw_events WHERE timestamp < NOW() - INTERVAL '7 days'`);
  await db.query(`DELETE FROM hourly_aggregates WHERE hour < NOW() - INTERVAL '90 days'`);
  await db.query(`DELETE FROM daily_aggregates WHERE day < NOW() - INTERVAL '2 years'`);
}
```

**Why Right:** Storage cost is predictable. Recent data has full granularity. Historical trends are preserved. Dashboards remain fast.

### WRONG: Calculating Percentiles in Application Code

```typescript
// WRONG: Loading all response times into memory
const times = await db.query('SELECT response_time_ms FROM events WHERE ...');
const sorted = times.map(t => t.response_time_ms).sort((a, b) => a - b);
const p99 = sorted[Math.floor(sorted.length * 0.99)];
```

**Why Wrong:** O(n) memory usage. For 1M events, that's 8MB just for numbers. Sorting is O(n log n). Can't handle large datasets.

### RIGHT: Approximate Percentiles with T-Digest

```typescript
// RIGHT: Using Redis or dedicated percentile data structures
// Redis doesn't have native t-digest, but PostgreSQL does:

const result = await db.query(`
  SELECT 
    percentile_cont(0.50) WITHIN GROUP (ORDER BY response_time_ms) as p50,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99
  FROM hourly_aggregates
  WHERE api_id = ? AND hour >= ?
`, [apiId, cutoff]);
```

**Why Right:** Database engines optimize percentile calculations. No application memory pressure. Exact percentiles for pre-aggregated data.
