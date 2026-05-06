# 01-THINKING: Bulkhead Pattern

## WHAT is the mental model?

A bulkhead is a **watertight compartment** in a ship. If one compartment floods, the others stay dry. In software, a bulkhead is a **resource compartment** per workload type. If the background job pool is exhausted, the critical request pool remains available.

## WHY does this mindset matter?

In microservices, different types of work have different priorities and failure modes. User-facing requests must succeed even if batch processing is backed up. Without bulkheads, a single queue or pool becomes a **single point of contention** for the entire system.

## HOW do we reason about bulkhead design?

### The Compartment Model

1. **Identify workload types**: `critical`, `background`, `analytics`, `webhook`.
2. **Assign limits**: Each pool gets a max concurrency based on importance and resource cost.
3. **Enforce isolation**: A request to pool A never touches pool B's slots.
4. **Reject, don't queue**: When a pool is full, return 503 immediately. Don't let requests sit in a shared queue.
5. **Monitor per-pool**: Track active, rejected, and queue-wait metrics per compartment.

```
┌─────────────────────────────────────────────┐
│                 System                       │
│  ┌─────────────┐    ┌─────────────┐         │
│  │ Pool A      │    │ Pool B      │         │
│  │ Critical    │    │ Background  │         │
│  │ max: 10     │    │ max: 5      │         │
│  │ active: 9   │    │ active: 5   │         │
│  │             │    │ FULL        │         │
│  └─────────────┘    └─────────────┘         │
│                                             │
│  User Request ──▶ Pool A: ACCEPTED          │
│  Background Job ─▶ Pool B: REJECTED (503)   │
└─────────────────────────────────────────────┘
```

## WRONG vs RIGHT Thinking

| WRONG Mindset | RIGHT Mindset |
|---------------|---------------|
| "One pool is simpler." | "One pool is a single point of failure." |
| "We'll just scale up." | "Scaling up doesn't fix contention between workload types." |
| "Queueing is better than rejecting." | "Queueing hides backpressure and causes cascading latency." |
| "All work is equal." | "User-facing work is more important than batch work." |

## Decision Checklist

- [ ] Are there separate pools for each workload type?
- [ ] Does each pool have an independently configurable limit?
- [ ] Are rejections immediate (no hidden queues)?
- [ ] Are metrics tracked per pool?
- [ ] Is there a fallback or degraded mode when a pool is full?
