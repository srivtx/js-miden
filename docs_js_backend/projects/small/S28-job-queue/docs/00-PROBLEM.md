# 00-PROBLEM

## WHAT
Build a background job queue using BullMQ and Redis that supports email, image processing, and data export jobs with retries, exponential backoff, dead letter queue, progress tracking, and cancellation.

## WHY
Slow work in the request path destroys latency and availability. A queue decouples producers from consumers, but introduces failure modes: lost jobs, infinite retries, poison pills, and blocked workers.

## Constraints
- Jobs must be durable (Redis persistence).
- Retries must use exponential backoff.
- Permanently failed jobs must move to a dead letter queue for inspection.
- Workers must support progress events and user cancellation.
