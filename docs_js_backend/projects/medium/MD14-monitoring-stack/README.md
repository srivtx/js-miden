# MD14: Monitoring Stack

A production-style metrics collection, time-series storage, alerting, and dashboard API system built with Express 5 and TypeScript (ESM).

## Architecture

- **Express 5** with TypeScript (ESM)
- **In-Memory Time-Series Store** with counter, gauge, and histogram support
- **Alert Engine** with rule evaluation
- **Dashboard API** for querying and inspecting series

## Thinking Framework

### Phase 1: Core Features
1. Collect metrics via HTTP API (counters, gauges, histograms)
2. Store in time-series format with labels
3. Alert when thresholds are exceeded
4. Dashboard API for querying and pruning

### Phase 2: Robustness
- **Cardinality Explosion**: The most dangerous bug in metrics systems. Unique IDs in labels create millions of series.
- **Retention Policies**: Without pruning, in-memory data grows unbounded.
- **Alert Flapping**: Rapid on/off toggling when values oscillate around a threshold.

### Phase 3: Bug Analysis

**Intentional Bug 1: Cardinality Explosion**

Located in `src/services/metricStore.ts` in `recordMetric()`.

The system accepts any labels without limits. A user can inject `requestId` or `userId` into labels, creating a new time series for every single request:

```typescript
// VULNERABLE CODE:
recordMetric('http_requests_total', 'counter', 1, {
  requestId: 'req-abc-123', // Unique every request!
  method: 'GET'
});
```

**Impact**: Memory exhaustion (OOM), query slowdown, degraded dashboard performance.

**Fix**: Enforce a cardinality limit per metric. Reject or drop labels that exceed the limit. Use a high-cardinality whitelist.

**Intentional Bug 2: No Retention Policy**

Located in `src/services/metricStore.ts` in `recordMetric()`.

Old data is never automatically removed. The `pruneOldData()` function exists but is only called via manual `/dashboard/prune` endpoint.

**Impact**: Memory grows forever. After weeks of operation, the process crashes.

**Fix**: Run a background job every N minutes that calls `pruneOldData(retentionHours)`.

**Intentional Bug 3: Alert Flapping**

Located in `src/services/alertEngine.ts` in `evaluateRules()`.

Alerts toggle immediately when the threshold is crossed. There is no `durationMs` enforcement or hysteresis:

```typescript
// VULNERABLE CODE:
if (triggered) { setActive(...) } else { setInactive(...) }
```

**Impact**: Pager storms, alert fatigue, operators ignore real alerts.

**Fix**: Require the condition to hold for `durationMs` before firing. Use hysteresis (different thresholds for firing vs resolving).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/metrics` | Record a metric value |
| GET | `/metrics/:name` | Query time series by name and labels |
| POST | `/alerts/rules` | Create an alert rule |
| GET | `/alerts/rules` | List alert rules |
| GET | `/alerts/states` | Evaluate and list alert states |
| GET | `/dashboard/series` | Get all series summary |
| POST | `/dashboard/prune` | Manually prune old data |
| GET | `/health` | Health check |

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run tests (some will fail due to intentional bugs)
npm test

# Start development server
npm run dev
```

## Environment Variables

```env
PORT=3000
RETENTION_HOURS=24
ALERT_EVAL_INTERVAL_MS=5000
```

## Testing the Bugs

### Cardinality Explosion
```bash
for i in {1..1000}; do
curl -X POST http://localhost:3000/metrics \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"http_requests_total\",\"type\":\"counter\",\"value\":1,\"labels\":{\"requestId\":\"req-$i\",\"method\":\"GET\"}}"
done
```

### Alert Flapping
```bash
curl -X POST http://localhost:3000/alerts/rules \
  -H "Content-Type: application/json" \
  -d '{"id":"cpu-rule","name":"High CPU","metricName":"cpu","condition":"gt","threshold":80,"durationMs":30000}'

curl -X POST http://localhost:3000/metrics \
  -H "Content-Type: application/json" \
  -d '{"name":"cpu","type":"gauge","value":85}'

curl http://localhost:3000/alerts/states
```
