# The Problem

## What Are We Building?
A real-time analytics platform that ingests events, aggregates them into time windows, and serves metrics via a dashboard API. Think: "How many sign-ups happened in the last 5 minutes? What's the error rate per second?"

## Why Does This Problem Exist?
Batch analytics (daily Hadoop jobs) tells you what happened yesterday. Real-time analytics tells you what's happening *now*. When a new feature launches, you need to see adoption, errors, and latency within seconds — not tomorrow morning.

## Who Will Use It?
- **Product Managers**: Watch feature adoption in real time during launches.
- **SREs**: Monitor error rates and latency spikes as they happen.
- **Data Engineers**: Feed raw events into downstream warehouses for batch processing.

## Constraints
- **Latency**: Event ingestion must be < 50ms per event.
- **Scale**: Must handle 10K events/second on a single node.
- **Correctness**: Aggregations must be accurate under concurrent load.
- **Retention**: Old window data must expire automatically.

## What We're NOT Building
- We are NOT building a full stream processor (Kafka Streams, Flink, Spark Streaming).
- We are NOT building a distributed time-series database (Prometheus, InfluxDB, TimescaleDB).
- We are NOT building complex event processing (CEP) with pattern matching.
