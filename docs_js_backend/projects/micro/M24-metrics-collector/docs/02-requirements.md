# Requirements: Metrics Collector

## Functional Requirements

1. **Metric Recording**: Record metrics with name, numeric value, and tags.

2. **Aggregation**: Compute count, sum, average, min, max, p95, p99.

3. **Time Windows**: Filter metrics by time window (e.g., last 5 minutes).

4. **Multi-metric Support**: Track many different metric names.

5. **Memory Safety**: Drop old data to prevent unbounded growth.

## API Requirements

- `POST /metrics` - Record metric
- `GET /metrics/:name?windowMs=...` - Get aggregated metrics
- `GET /metrics` - Get all metrics

## Non-Functional Requirements

- O(n log n) aggregation at worst
- Constant memory per time window
- Thread-safe recording
- Accurate percentile calculation

## Acceptance Criteria

- [ ] Can record metrics
- [ ] Returns correct count and average
- [ ] Returns correct p95 and p99
- [ ] Time window filters old data
- [ ] Memory doesn't grow unbounded
- [ ] Handles missing metrics gracefully
