# Architecture Decisions

## Decision: Storage Backend

### Option A: In-Memory Map
**Pros:** Zero I/O latency, simple, no external dependency.
**Cons:** Lost on restart, bounded by RAM.

### Option B: SQLite on Disk
**Pros:** Persistent, SQL queryable.
**Cons:** Write contention, disk I/O slows ingestion.

### Option C: Append-Only Log + In-Memory Index
**Pros:** Fast writes, recoverable.
**Cons:** More complex, need compaction.

### What We Chose: Option A (In-Memory Map)
**Why:** For a single-node monitoring agent, simplicity wins. We accept data loss on crash (metrics are ephemeral by nature).

## Decision: Metric Types

### Option A: Only Counters and Gauges
**Pros:** Simple, covers 80% of use cases.
**Cons:** No latency distribution (histograms are essential for SLIs).

### Option B: Counters, Gauges, Histograms, Summaries
**Pros:** Full Prometheus compatibility.
**Cons:** Summaries are complex (quantiles over sliding windows).

### What We Chose: Counters, Gauges, Histograms
**Why:** Histograms give us p50/p99/p999. We skip Summaries because they require client-side computation that's hard to aggregate.

## Decision: Alert Evaluation Model

### Option A: Push (Metrics push to alert engine)
**Pros:** Instant evaluation.
**Cons:** Tight coupling, hard to scale.

### Option B: Pull (Alert engine polls metrics)
**Pros:** Decoupled, can batch evaluate.
**Cons:** Slight delay (acceptable).

### What We Chose: Pull Model
**Why:** The alert engine polls all series every `ALERT_EVAL_INTERVAL_MS`. This is how Prometheus works and it scales better.
