# 01-THINKING

## Mental Model
A job queue is a distributed state machine. Once a job leaves the producer, its fate is in the hands of the worker, Redis, and the network.

## Hot Path
1. Producer enqueues job JSON.
2. Redis persists job.
3. Worker picks job.
4. Processor runs.
5. Worker ACKs success or NACKs failure.
6. On max retries, move to dead letter queue.

## Danger Zones
- **Timeouts**: A job that hangs forever blocks a worker. Other jobs starve.
- **Idempotency**: Retried jobs must not double-charge or double-email.
- **Poison pills**: A malformed payload crashes the worker repeatedly.
- **Progress loss**: If a job updates progress but crashes before completion, progress is misleading.
- **Memory leaks**: Large payloads in Redis bloat memory.
