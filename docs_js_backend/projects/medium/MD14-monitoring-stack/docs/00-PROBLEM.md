# The Problem

## What Are We Building?
A metrics collection, time-series storage, alerting, and dashboard system — the foundational layer of observability for any production backend.

## Why Does This Problem Exist?
When systems break at 3 AM, you need data. Not logs (too noisy), not traces (too late), but metrics: "CPU was at 95% for 10 minutes before the crash." Without a monitoring stack, you're debugging blind.

## Who Will Use It?
- **SREs**: Set alert thresholds, get paged when things break.
- **Developers**: Instrument their code with counters and histograms.
- **Operators**: Query dashboards during incidents.

## Constraints
- **Time**: Metric ingestion must be < 1ms per sample.
- **Scale**: Must handle 10K+ samples/second per node.
- **Correctness**: Alerts must not false-positive (flap) or false-negative (miss).
- **Budget**: In-memory store with configurable retention.

## What We're NOT Building
- We are NOT building a distributed TSDB like Prometheus or VictoriaMetrics.
- We are NOT building a log aggregation system.
- We are NOT building a tracing backend (Jaeger/Zipkin).
