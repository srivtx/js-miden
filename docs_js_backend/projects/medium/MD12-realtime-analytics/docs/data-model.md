# Data Model

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐
│    Event     │       │   MetricRollup   │
├──────────────┤       ├──────────────────┤
│ id (PK)      │       │ id (PK)          │
│ event_type   │       │ metric_name      │
│ payload (JSON)│       │ window_key (UQ)  │
│ source       │       │ window_start     │
│ timestamp    │       │ window_end       │
│ window_key   │       │ count            │
│ processed_at │       │ sum              │
└──────────────┘       │ avg              │
                       │ min              │
                       │ max              │
                       │ unique_keys      │
                       │ created_at       │
                       │ updated_at       │
                       └──────────────────┘
```

## Schema

### Event Table
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'api',
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  window_key TEXT NOT NULL,
  processed_at TIMESTAMP,
  
  INDEX idx_event_type_timestamp (event_type, timestamp),
  INDEX idx_window_key (window_key),
  INDEX idx_timestamp (timestamp)
);
```

### Metric Rollup Table
```sql
CREATE TABLE metric_rollups (
  id TEXT PRIMARY KEY DEFAULT cuid(),
  metric_name TEXT NOT NULL,
  window_key TEXT NOT NULL,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  count INT NOT NULL DEFAULT 0,
  sum FLOAT NOT NULL DEFAULT 0,
  avg FLOAT NOT NULL DEFAULT 0,
  min FLOAT,
  max FLOAT,
  unique_keys INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (metric_name, window_key),
  INDEX idx_metric_window (metric_name, window_start),
  INDEX idx_window_key (window_key)
);
```

## Redis Schema

### Counters
```
Key: counter:<event_type>:<window_key>
Value: Integer (event count)
TTL: <retention_hours> * 3600

Example: counter:page_view:2024-01-01T12:00:00.000Z
```

### Rates
```
Key: rate:<event_type>
Value: Integer (events per second)
TTL: 60 seconds

Example: rate:page_view
```

### Sums
```
Key: sum:<event_type>:<window_key>
Value: Float (sum of values)
TTL: <retention_hours> * 3600
```

### Event Types Set
```
Key: event:types
Value: Set of all event types
TTL: No expiration
```

## Windowing

### Tumbling Window Key Format
```
<ISO8601 timestamp rounded to window boundary>

Example (1-minute windows):
2024-01-01T12:00:00.000Z
2024-01-01T12:01:00.000Z
```

### Window Size Configuration
```
AGGREGATION_WINDOW_MS=60000  # 1 minute
```

## Data Lifecycle

### Hot Data (Redis)
- Current window
- Last N windows
- Real-time rates

### Warm Data (PostgreSQL)
- Recent rollups (last 24 hours)
- Raw events (last 7 days)

### Cold Data (Archive)
- Historical rollups (> 7 days)
- Raw events (> 30 days)

## Retention Policy

```sql
-- Clean up old events
DELETE FROM events 
WHERE timestamp < NOW() - INTERVAL '30 days';

-- Clean up old rollups
DELETE FROM metric_rollups 
WHERE window_start < NOW() - INTERVAL '90 days';
```

## Data Volume Estimates

| Metric | Value |
|--------|-------|
| Events per second | 10,000 |
| Events per minute | 600,000 |
| Events per hour | 36,000,000 |
| Events per day | 864,000,000 |
| Avg event size | 500 bytes |
| Daily storage | ~400 GB |

## References

- PostgreSQL JSONB: https://www.postgresql.org/docs/current/datatype-json.html
- Redis Data Types: https://redis.io/docs/data-types/
- Time-Series Patterns: https://redis.io/docs/data-types/timeseries/