# Concepts Explained

## Concept: Time-Series Data

### WHAT Is It?
A sequence of data points indexed in time order. Each point has a timestamp and a value.

### WHY Do We Use It?
Metrics are inherently temporal. "What was the sign-up rate at 14:03?" requires time-indexed storage.

### HOW Does It Work?
```typescript
interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

// Tumbling window key
function getWindowKey(timestamp: Date, windowSizeMs: number): string {
  const windowStart = Math.floor(timestamp.getTime() / windowSizeMs) * windowSizeMs;
  return new Date(windowStart).toISOString();
}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Storing each sample as a SQL row (`INSERT INTO metrics VALUES (...)`). Queries scan millions of rows. | Grouping by series key, storing aggregates (count, sum) per window. |
| Using `Date.now()` without timezone awareness. DST breaks windows. | Using ISO 8601 UTC strings or Unix epoch ms. |

---

## Concept: Windowing

### WHAT Is It?
Dividing an infinite stream of events into finite chunks for aggregation.

### WHY Do We Use It?
You can't query "all events ever" in real time. Windows bound the dataset.

### HOW Does It Work?

**Tumbling Windows (Non-Overlapping):**
```
Time:  [0-60s)[60-120s)[120-180s)
Window:   W1       W2        W3
```

**Sliding Windows (Overlapping):**
```
Time:  [0-60s)[30-90s)[60-120s)
Window:   W1       W2       W3
```

**Session Windows (Dynamic):**
```
Time:  [0-45s)  [120-180s)
Window:  S1         S2
          (gap > 60s)
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Window size of 1ms. Creates infinite keys. | Window size of 1 minute or 1 hour. Manageable key space. |
| No window alignment. `W1` starts at event time, not epoch. | Align to epoch (`Math.floor(ts / windowSize) * windowSize`). |

---

## Concept: Race Conditions in Aggregation

### WHAT Is It?
When two concurrent operations read the same value, modify it, and write back, one update is lost.

### WHY Does It Happen?
Application-side read-modify-write is not atomic. The database (or cache) sees two independent writes.

### HOW Does It Work?
```typescript
// WRONG: Race condition
const current = await redis.get('counter:signups:2024-01-01T00:00:00Z'); // Both read "5"
const newVal = parseInt(current ?? '0', 10) + 1; // Both compute "6"
await redis.set(key, newVal); // Both write "6". Should be "7".

// RIGHT: Atomic increment
await redis.incr('counter:signups:2024-01-01T00:00:00Z'); // Server-side atomic
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| `GET` → `SET` for counters | `INCR`, `HINCRBY`, `INCRBYFLOAT` |
| Computing averages on write | Storing sum + count, computing average on read |
| No TTL on window keys | `EXPIRE` on every key to auto-cleanup |

---

## Concept: Event Ingestion vs. Event Processing

### WHAT Is It?
Ingestion = accepting and storing the raw event. Processing = transforming the event into aggregated metrics.

### WHY Separate Them?
Ingestion must be fast and durable. Processing can be async, retried, and scaled independently.

### HOW Does It Work?
```
Client → Ingestion API → PostgreSQL (raw events)
                              ↓
                         Aggregation Worker
                              ↓
                           Redis (counters)
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Processing inside the HTTP request handler. Slow, blocks client. | Acknowledge ingestion immediately, process async. |
| Dropping events if Redis is down. | Buffer events in PostgreSQL, retry Redis later. |

---

## Concept: Cardinality in Time-Series

### WHAT Is It?
The number of unique time series. If `http_requests_total` has labels `method` (3 values) and `status` (5 values), cardinality = 3 × 5 = 15.

### WHY Is It Dangerous?
If `userId` (1M values) is added, cardinality becomes 3 × 5 × 1M = 15M. Each series has overhead (~1KB). 15M × 1KB = 15GB RAM.

### Real-World Impact
In 2021, a major cloud provider had an outage because a team added `traceId` to a metric label. Cardinality exploded to billions. The monitoring system OOM'd and took down the control plane.

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| High-cardinality labels (`userId`, `requestId`, `traceId`). | Low-cardinality labels (`method`, `status`, `region`). |
| No cardinality limits. | Drop or aggregate high-cardinality series. |
