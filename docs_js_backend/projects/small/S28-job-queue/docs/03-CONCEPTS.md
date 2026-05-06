# 03-CONCEPTS

## At-Least-Once Delivery
- **WHAT**: A job may be processed one or more times.
- **WHY**: Networks and crashes make exactly-once delivery impossible without distributed transactions.
- **HOW**: Make processors idempotent using idempotency keys.
- **WRONG**: Sending an email every retry without checking if already sent.
- **RIGHT**: `if (await sentAlready(idempotencyKey)) return; else send()`.

## Exponential Backoff
- **WHAT**: Retry delays double (with jitter) after each failure.
- **WHY**: Prevents thundering herd on recovering downstream services.
- **HOW**: BullMQ `backoff: { type: 'exponential', delay: 1000 }`.
- **WRONG**: Fixed 1-second retry forever.
- **RIGHT**: 1s, 2s, 4s, 8s... up to a max.

## Dead Letter Queue
- **WHAT**: A holding area for jobs that failed permanently.
- **WHY**: Prevents infinite retry loops and allows manual inspection.
- **HOW**: On `attemptsMade >= maxAttempts`, move job to DLQ.
- **WRONG**: Dropping failed jobs or retrying forever.
- **RIGHT**: Separate queue with alerting for ops team.
