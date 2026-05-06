# WHAT: Metrics Collector

## Definition

A metrics collector gathers quantitative data about application performance and behavior, storing it for analysis and alerting.

## Types of Metrics

### Counters
- Monotonically increasing
- Examples: requests served, errors occurred

### Gauges
- Current value that can go up or down
- Examples: queue depth, memory usage, temperature

### Histograms
- Distribution of values into buckets
- Examples: response time, request size

### Summaries
- Pre-computed percentiles
- Examples: p95 latency, p99 latency

## Aggregation Functions

- **Count**: Number of observations
- **Sum**: Total of all values
- **Average**: Sum / Count
- **Min/Max**: Range boundaries
- **Percentiles**: p50, p95, p99

## Time Windows

- **Instant**: Current value only
- **Rolling**: Last N minutes/hours
- **Fixed**: Calendar-aligned buckets (per minute, per hour)

## Key Metrics

- **Collection Rate**: Metrics per second
- **Query Latency**: Time to compute aggregations
- **Memory Usage**: Storage per metric
- **Accuracy**: Statistical correctness
