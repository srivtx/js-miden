# OLD vs NEW: Metrics Collector

## Pattern 1: Console Logging as Metrics (2015)

### Old Code

```typescript
// 2015: "Metrics" via console.log
app.get('/api/users', async (req, res) => {
  const start = Date.now();
  const users = await db.getUsers();
  const duration = Date.now() - start;
  
  console.log(`GET /api/users took ${duration}ms`);
  res.json(users);
});
```

**Why it was done:** Simple. No setup required. Logs are already collected.

**Why it's wrong now:**
- Can't aggregate across requests ("What's the P95?" requires parsing all logs)
- Can't alert on thresholds
- Log processing is expensive
- No time-series visualization
- Lost when logs rotate

### New Code (2025)

```typescript
// 2025: Structured metrics with aggregation
const collector = new MetricsCollector();

app.get('/api/users', async (req, res) => {
  const start = Date.now();
  const users = await db.getUsers();
  const duration = Date.now() - start;
  
  collector.record('response_time', duration, {
    endpoint: '/api/users',
    method: 'GET',
  });
  
  res.json(users);
});

// Dashboard queries:
// GET /metrics/response_time?windowMs=300000
// Returns: { count, avg, p95, p99 }
```

**Why it's better:**
- Real-time aggregation
- Alert-friendly
- Time-windowed queries
- Structured dimensions (tags)

---

## Pattern 2: Global Counters (2016-2018)

### Old Code

```typescript
// 2017: Global counter variables
let totalRequests = 0;
let totalErrors = 0;
let totalResponseTime = 0;

app.use((req, res, next) => {
  totalRequests++;
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    totalResponseTime += duration;
    if (res.statusCode >= 400) totalErrors++;
  });
  
  next();
});

app.get('/stats', (req, res) => {
  res.json({
    totalRequests,
    totalErrors,
    avgResponseTime: totalResponseTime / totalRequests,
  });
});
```

**Why it was done:** Simple counters. Easy to understand.

**Why it's wrong now:**
- Only totals, no time windows ("What was the error rate in the last 5 minutes?" impossible)
- No percentiles
- Not thread-safe (in multi-threaded environments)
- Can't break down by endpoint
- Reset on restart

### New Code (2025)

```typescript
// 2025: Time-series collector with dimensions
const collector = new MetricsCollector();

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    collector.record('response_time', duration, {
      endpoint: req.route?.path || req.path,
      method: req.method,
      status: res.statusCode.toString(),
    });
    
    collector.record('requests', 1, {
      endpoint: req.route?.path || req.path,
      status: res.statusCode.toString(),
    });
  });
  
  next();
});

app.get('/stats', (req, res) => {
  const windowMs = parseInt(req.query.windowMs as string) || 60000;
  const metrics = collector.getMetrics('response_time', windowMs);
  res.json(metrics);
});
```

**Why it's better:**
- Time-windowed queries
- Dimensions (endpoint, method, status)
- Percentiles (p95, p99)
- Doesn't reset (with proper retention)

---

## Pattern 3: Custom Metrics vs Prometheus (2015-2020 vs 2025)

### Old Approach: Custom In-Memory Dashboard (2018)

```typescript
// 2018: Hand-rolled metrics endpoint
const metrics = {
  requests: [],
  errors: [],
};

app.get('/metrics', (req, res) => {
  res.json({
    requests: metrics.requests,
    errors: metrics.errors,
  });
});
```

**Why it was done:** Didn't want to run Prometheus. Thought custom solution would be simpler.

**Why it's wrong now:**
- No standard format (Prometheus, StatsD)
- No ecosystem (Grafana dashboards, alerting rules)
- Reinventing the wheel
- Hard to integrate with existing monitoring

### New Approach: Prometheus / OpenTelemetry (2025)

```typescript
// 2025: Prometheus client
import { register, Histogram, Counter } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path, status: res.statusCode });
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Why it's better:**
- Industry standard format
- Works with Grafana out of the box
- Built-in histogram buckets
- Automatic aggregation
- No memory leaks (designed for long-running processes)

**Prometheus metrics output:**
```
# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/api",status="200"} 95
http_request_duration_seconds_bucket{le="0.5",method="GET",route="/api",status="200"} 99
http_request_duration_seconds_bucket{le="1",method="GET",route="/api",status="200"} 100
http_request_duration_seconds_sum{method="GET",route="/api",status="200"} 15.2
http_request_duration_seconds_count{method="GET",route="/api",status="200"} 100
```

---

## Pattern 4: Manual Health Checks vs Automated Observability (2020 vs 2025)

### Old Approach: Manual Health Endpoint (2018)

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

**Why it was done:** Simple. Load balancer checks this. If it returns 200, service is "healthy."

**Why it's wrong now:**
- Doesn't check dependencies (database, cache)
- No metrics
- Static response (always "ok" until it crashes)
- Not actionable

### New Approach: Comprehensive Health + Metrics (2025)

```typescript
app.get('/health', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkExternalAPI(),
  ]);
  
  const unhealthy = checks.filter(c => !c.healthy);
  
  res.status(unhealthy.length > 0 ? 503 : 200).json({
    status: unhealthy.length > 0 ? 'unhealthy' : 'healthy',
    checks: Object.fromEntries(checks.map(c => [c.name, c.healthy])),
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
  });
});
```

**Why it's better:**
- Checks all dependencies
- Returns 503 if unhealthy (load balancer removes from pool)
- Includes resource metrics
- Actionable for debugging
