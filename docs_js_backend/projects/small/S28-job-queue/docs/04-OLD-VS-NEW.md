# 04-OLD-VS-NEW

## 2015 Patterns
- `setTimeout` or `process.nextTick` for background work.
- Cron jobs running on a single server (no redundancy).
- No retry logic; if it fails, it fails.
- In-process queues that vanish on deploy or crash.
- No observability; log files on disk.

## 2025 Patterns
- BullMQ / RabbitMQ / Kafka for durable, distributed queues.
- Separate worker processes orchestrated by Kubernetes or Nomad.
- Exponential backoff with dead letter queues.
- Idempotency keys for exactly-once semantics.
- OpenTelemetry tracing through queue boundaries.
- Temporal / Cadence for durable execution of long-running workflows.
