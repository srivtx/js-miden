# Performance Guide

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Ingestion Latency | < 10ms | < 50ms |
| Aggregation Latency | < 5ms | < 20ms |
| Dashboard Latency | < 100ms | < 500ms |
| Throughput | 10,000 EPS | 5,000 EPS |
| Error Rate | < 0.1% | < 1% |

## Optimization Strategies

### 1. Redis Atomic Operations
Use atomic commands instead of read-modify-write:
```typescript
// BAD: Race condition
const current = await redis.get(key);
await redis.set(key, parseInt(current) + 1);

// GOOD: Atomic
await redis.incr(key);
```

### 2. Redis Pipelining
Batch multiple operations:
```typescript
const pipeline = redis.pipeline();
for (const event of events) {
  pipeline.incr(`counter:${event.eventType}`);
}
await pipeline.exec();
```

### 3. Lua Scripts
Complex atomic operations:
```lua
local key = KEYS[1]
local increment = ARGV[1]
local current = redis.call('GET', key) or 0
local new = tonumber(current) + tonumber(increment)
redis.call('SET', key, new)
return new
```

### 4. Windowing Optimization
```typescript
// Pre-calculate window keys
const windowKey = getWindowKey(timestamp);

// Use Redis sorted sets for time-series
redis.zadd(`ts:${eventType}`, timestamp, eventId);
```

### 5. PostgreSQL Optimization
```sql
-- Partition events by time
CREATE TABLE events_2024_01 PARTITION OF events
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Use BRIN indexes for time-series
CREATE INDEX idx_events_time_brin ON events USING BRIN (timestamp);
```

### 6. Backpressure Handling
```typescript
const queue = new PQueue({ concurrency: 100 });

app.post('/events', async (req, res) => {
  if (queue.size > 10000) {
    return res.status(503).json({ error: 'Server overloaded' });
  }
  await queue.add(() => processEvents(req.body));
  res.json({ ingested: req.body.length });
});
```

## Benchmarks

| Scenario | Without Optimization | With Optimization |
|----------|---------------------|-------------------|
| 10k events | 5000ms | 200ms |
| Dashboard query | 2000ms | 50ms |
| Aggregation | 100ms | 5ms |

## Monitoring

### Key Metrics
- Events per second
- Aggregation latency
- Redis memory usage
- PostgreSQL connection count
- Queue depth

### Tools
```bash
# Redis monitoring
redis-cli --latency

# PostgreSQL monitoring
SELECT * FROM pg_stat_statements ORDER BY total_time DESC;

# Application metrics
prometheus --config.file=prometheus.yml
```

## Load Testing

```bash
# Using k6
k6 run --vus 100 --duration 60s load-test.js
```

```javascript
// load-test.js
import http from 'k6/http';

export default function () {
  http.post('http://localhost:3000/events', JSON.stringify({
    eventType: 'page_view',
    payload: { url: '/' },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## References

- Redis Performance: https://redis.io/docs/management/optimization/
- PostgreSQL Performance: https://wiki.postgresql.org/wiki/Performance_Optimization
- Stream Processing: https://www.confluent.io/learn/stream-processing/