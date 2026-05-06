# Research Notes

## Sources
- **Brendan Gregg, "Systems Performance" (2020)**: Deep dive into metrics, counters, and tracing. Key finding: counters are free (no lock on x86 with `LOCK INC`), histograms are expensive (bucket selection).
- **Prometheus Documentation**: Best practices for metric naming, label cardinality, and histogram buckets. Cardinality is the #1 cause of Prometheus OOM.
- **Google SRE Book, "Monitoring Distributed Systems" (2017)**: Defines the four golden signals (latency, traffic, errors, saturation). Alerting should be symptom-based, not cause-based.
- **Cortex / Thanos Architecture Papers**: How to shard and federate Prometheus for multi-tenant scale.

## Latest Trends (2025)
- **OpenTelemetry (OTLP)**: Replacing Prometheus exposition format. Structured, efficient protobuf encoding.
- **eBPF-based metrics**: Kernel-level metrics without instrumentation (Pixie, Groundcover).
- **AI-assisted anomaly detection**: Baseline alerts instead of static thresholds (e.g., Honeycomb BubbleUp).

## Benchmarks
- Prometheus remote-write: ~100K samples/second per CPU core.
- In-memory map insertion: ~5M ops/second (single-threaded).
- Cardinality of 1M series: ~1GB RAM (Go) or ~2GB RAM (Node.js).

## Industry Adoption
- **Netflix**: Atlas (in-memory TSDB) with strict cardinality limits.
- **Uber**: M3DB, sharded by metric name hash.
- **Shopify**: StatsD → Prometheus → Thanos. Cardinality guardrails in CI.
