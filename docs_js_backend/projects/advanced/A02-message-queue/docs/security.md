# Security

## Authentication

- Optional API keys for queue access
- IP-based rate limiting for publishing

## Message Security

- Messages encrypted in transit (TLS)
- At-rest encryption for persisted messages
- Access control per queue

## Delivery Guarantees

- At-least-once delivery
- Consumer must handle duplicates idempotently
- Ack tokens prevent unauthorized deletions

## Data Protection

- Message retention policies
- Automatic purging after TTL
- Audit logs for admin operations

## Known Vulnerabilities

1. **Message Loss**: In-memory storage loses data on crash
2. **No Ordering**: Messages can be consumed out of order

## Hardening

- Persist messages to disk
- Implement FIFO ordering
- Access control lists per queue
- Message size limits (1MB default)
