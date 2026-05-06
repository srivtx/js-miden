# Overview: Metrics Collector

A metrics collector gathers application performance data, computes aggregations (count, average, percentiles), and helps identify bottlenecks and anomalies.

## Project Goal

Build a metrics collector that records time-series data and returns aggregated statistics including count, average, p95, and p99.

## Learning Outcomes

After completing this project, you will understand:
- Time-series data management
- Aggregation windows and sliding windows
- Percentile calculations
- Histograms vs summaries
- Memory management for high-volume metrics

## Real-World Context

Metrics collection powers Prometheus, Datadog, New Relic, CloudWatch, and Grafana. Every production system needs observability through metrics.

## File Structure

```
src/
  index.ts             - Express server
  metrics-collector.ts - Core metrics collector
tests/
  metrics-collector.test.ts - Test suite
docs/
  01-overview.md
  02-requirements.md
  03-architecture.md
  04-what.md
  05-why.md
  06-how.md
  07-wrong-vs-right.md
  08-testing.md
  09-bugs.md
```
