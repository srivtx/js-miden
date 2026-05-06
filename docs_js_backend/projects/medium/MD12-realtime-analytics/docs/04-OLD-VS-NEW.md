# Old Ways vs New Ways (2015 vs 2025)

## Pattern: Analytics Data Pipeline

### The Old Way (2010-2015)
```bash
# Cron job every hour
crontab -l
0 * * * * /usr/local/bin/aggregate_hourly.sh
# Script runs SELECT COUNT(*) FROM events WHERE created_at > NOW() - INTERVAL '1 hour'
# Writes result to a CSV on NFS
```
**Why we did it:** Simple, works with existing SQL skills.
**Why it's wrong now:** Batch latency is 1 hour minimum. NFS CSVs are not queryable. No real-time alerting.

### The New Way (2025)
```typescript
// Real-time ingestion + aggregation
router.post('/events', async (req, res) => {
  const events = validate(req.body);
  await prisma.event.createMany({ data: events });
  for (const event of events) {
    await redis.incr(`counter:${event.eventType}:${windowKey}`);
  }
  res.status(201).json({ ingested: events.length });
});
```
**Why it's better:** Sub-second latency. Queryable via API. Automatic TTL cleanup.

### Migration Path
1. Add event ingestion endpoint alongside existing batch jobs.
2. Run both in parallel for validation.
3. Replace batch dashboards with real-time API.
4. Decommission cron jobs.

---

## Pattern: Counter Aggregation

### The Old Way
```sql
-- Application-side read-modify-write
BEGIN;
SELECT count FROM counters WHERE name = 'signups' FOR UPDATE;
-- (application adds 1)
UPDATE counters SET count = 6 WHERE name = 'signups';
COMMIT;
```
**Why it's wrong:** Row-level locking serializes all increments. Throughput is ~100 ops/second.

### The New Way
```typescript
// Redis atomic increment
await redis.incr('counter:signups:2024-01-01T00:00:00Z');
await redis.expire(key, 86400);
```
**Why it's better:** No locks, no transactions, 100K+ ops/second per Redis instance.

---

## Pattern: Windowed Aggregation

### The Old Way
```sql
-- Query-time grouping (slow on large tables)
SELECT date_trunc('hour', timestamp), COUNT(*)
FROM events
GROUP BY 1
ORDER BY 1;
```
**Why it's wrong:** Scans the entire events table. Gets slower linearly with data volume.

### The New Way
```typescript
// Pre-aggregated windows in Redis
const windows = await redis.mget(
  `counter:signups:${getWindowKey(now, 0)}`,
  `counter:signups:${getWindowKey(now, -1)}`,
  `counter:signups:${getWindowKey(now, -2)}`,
);
```
**Why it's better:** O(1) lookups. No table scans. Bounded memory via TTL.

---

## Pattern: Time-Series Storage

### The Old Way
Round-robin databases (RRDtool) with fixed-size files.
**Why it's wrong:** Fixed resolution, hard to query ad-hoc, no label support.

### The New Way
Columnar time-series DBs (ClickHouse, TimescaleDB, VictoriaMetrics) or in-memory maps with TTL (Redis, Prometheus).
**Why it's better:** Compression ratios of 10:1 or better. SQL-like querying. Dynamic retention. Label-based filtering.

---

## Pattern: Alerting on Metrics

### The Old Way
```bash
# Nagios / Cron-based
*/5 * * * * /usr/local/bin/check_cpu.sh || page_oncall
```
**Why it's wrong:** No context, no history, flaps constantly.

### The New Way
```typescript
const rule = {
  metricName: 'error_rate',
  condition: 'gt',
  threshold: 0.05, // 5%
  durationMs: 300_000, // Must exceed for 5 minutes
  severity: 'critical',
};
```
**Why it's better:** Duration requirement prevents flapping. Labels allow routing to the right team.
