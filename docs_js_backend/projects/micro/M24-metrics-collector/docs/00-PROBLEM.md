# PROBLEM: Metrics Collector

## WHAT We're Building

A metrics collector that gathers application performance data (response times, request counts, error rates), computes aggregations (count, sum, average, min, max, p95, p99), and supports time-windowed queries to prevent unbounded memory growth.

## WHY This Matters

You can't optimize what you don't measure. Metrics are the foundation of observability. Without metrics:
- You don't know if your API is slow
- You can't detect traffic spikes
- You can't identify bottlenecks
- You're flying blind in production

Every production system needs metrics. Prometheus, Datadog, New Relic, CloudWatch, and Grafana all exist because of this fundamental need.

## Constraints

1. **Time-Series Data**: Each metric has a name, value, tags, and timestamp
2. **Aggregation**: Must compute count, sum, avg, min, max, p95, p99
3. **Time Windows**: Must filter metrics by sliding time window (e.g., last 5 minutes)
4. **Memory Safety**: Old metrics must be evictable to prevent OOM
5. **No External Dependencies**: Pure Node.js for this micro-project
6. **Performance**: Recording a metric must be <1ms
7. **Tag Support**: Metrics can have key-value tags for dimensions

## Real-World Context

Metrics collection powers every monitoring dashboard. In 2017, a lack of proper metrics monitoring at GitLab contributed to a database incident where 300GB of data was accidentally deleted - the absence of clear metrics delayed detection. In 2021, a Facebook outage was exacerbated by monitoring systems being unreachable. Metrics aren't just for graphs; they're for survival.

## Success Criteria

- [ ] Metrics can be recorded via API
- [ ] Aggregated statistics are computed correctly
- [ ] Time window filtering returns only recent metrics
- [ ] Missing metrics return 404
- [ ] Bulk queries return all metric names
- [ ] Memory usage stays bounded with time windows
