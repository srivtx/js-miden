# Architecture

## Overview

The Distributed Message Queue provides at-least-once message delivery with topics, queues, and consumer acknowledgments.

## Components

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Producer │────▶│  Queue   │────▶│ Consumer │
│          │     │ Manager  │     │          │
└──────────┘     └────┬─────┘     └──────────┘
                      │
              ┌───────┴───────┐
              │  In-Memory    │
              │  / Disk       │
              │  Storage      │
              └───────────────┘
```

## Message Lifecycle

```
PUBLISHED ──▶ VISIBLE ──▶ CONSUMED ──▶ ACKED (deleted)
                              │
                              └──▶ TIMEOUT ──▶ REDELIVERED
```

## Delivery Guarantees

### At-Least-Once
- Message delivered one or more times
- Consumer must handle idempotency
- Requires acknowledgment

### At-Most-Once (Not Implemented)
- Message delivered zero or one times
- Faster but may lose messages

### Exactly-Once (Not Implemented)
- Message delivered exactly one time
- Requires deduplication and transactions
- Complex to implement correctly

## Storage Strategies

### In-Memory (Current - BUG)
- Fast but messages lost on crash
- Good for testing only

### Append-Only Log
- Messages appended to segment files
- Index for fast lookups
- Similar to Kafka

### WAL + Memory
- Write-ahead log for durability
- In-memory for speed
- Checkpoint periodically

## Message Ordering

### Per-Queue FIFO
- Messages processed in publish order
- Requires single consumer or ordered processing

### Per-Partition Ordering
- Partition by key (e.g., userId)
- Messages for same key are ordered
- Different keys processed in parallel
