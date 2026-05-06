# 08-CRITIQUE

## Senior Engineer Review

### What is done well
- BullMQ is a solid choice for Redis-based queuing in Node.js.
- Dead letter queue is implemented for permanently failed jobs.
- Exponential backoff configuration is correct.

### What is risky
- In-process workers share fate with the API process. A crashing job kills the server.
- No idempotency keys in job payloads. Retries can double-send emails or double-process images.
- No observability: no metrics, no tracing, no structured logging.

### What is missing
- Job timeouts. This is the intentional bug, but even beyond that, there is no max runtime enforced.
- Stalled job check. BullMQ has settings for this; they are not configured.
- Separate worker binary for production deployments.

### The Bug
A job without a timeout is a ticking time bomb. One poison pill or one slow downstream dependency can stall the entire queue. Always set `lockDuration`, `timeout`, and monitor stalled jobs with alerts.
