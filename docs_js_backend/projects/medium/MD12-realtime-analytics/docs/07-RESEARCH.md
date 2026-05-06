# Research Notes

## Sources
- **Akidau, T. (2015). "The World Beyond Batch: Streaming 101"**. O'Reilly.
  - Foundational text on stream processing. Defines event time vs. processing time, windowing strategies (tumbling, sliding, session), and watermarks.
- **Carbone, P., et al. (2015). "Apache Flink: Stream and Batch Processing in a Single Engine"**. IEEE.
  - Flink's windowing and state management. Key insight: incremental aggregation (pre-aggregating within windows) reduces state size.
- **Zaharia, M., et al. (2013). "Discretized Streams: Fault-Tolerant Streaming Computation at Scale"**. SOSP.
  - Spark Streaming's micro-batch approach. Shows that mini-batch windows can approximate true streaming with simpler fault tolerance.
- **Kleppmann, M. (2017). "Designing Data-Intensive Applications"**. O'Reilly.
  - Chapter 11 covers stream processing, exactly-once semantics, and idempotency. Chapter 2 compares batch vs. stream processing trade-offs.
- **Apache Kafka Documentation**: https://kafka.apache.org/documentation/
  - Kafka Streams windowing (tumbling, hopping, session). KTables for materialized views.
- **Redis Documentation**: https://redis.io/docs/
  - `INCR`, `INCRBY`, `INCRBYFLOAT`, `EXPIRE`, `TTL` commands. Single-threaded atomicity guarantees.
- **TimescaleDB Documentation**: https://docs.timescale.com/
  - Hypertables and continuous aggregates. Shows how relational databases can do time-series with proper indexing.

## Latest Trends (2025)
- **Apache Flink v1.18**: Unified batch/stream SQL with adaptive batching.
- **Materialize**: SQL on streaming with correctness guarantees (consolidation, strict serializability).
- **Redpanda**: Kafka-compatible streaming without ZooKeeper. 10x lower p99 latencies.
- **ClickHouse**: Columnar time-series DB with real-time ingestion. Used by Cloudflare for analytics.
- **eBPF-based observability**: Kernel-level event collection without application instrumentation (Pixie, Groundcover).

## Benchmarks
- Redis `INCR`: ~100K ops/second per instance (single-threaded).
- PostgreSQL `INSERT`: ~50K rows/second with `createMany` batching.
- Application-side `GET` + `SET`: ~5K ops/second (bottlenecked by round-trip latency).
- Redis memory per key: ~100 bytes for a string key + value. 1M keys = ~100MB.

## Industry Adoption
- **Netflix**: Atlas (in-memory TSDB) with strict cardinality limits. Real-time dashboards for 200M+ users.
- **Uber**: M3DB, sharded by metric name hash. Handles 10B+ time series.
- **Shopify**: StatsD → Prometheus → Thanos. Cardinality guardrails in CI.
- **Cloudflare**: ClickHouse for HTTP analytics. 10M+ rows/second ingestion.
- **Stripe**: Kafka → Flink for real-time fraud detection. Windowed aggregations on payment events.
