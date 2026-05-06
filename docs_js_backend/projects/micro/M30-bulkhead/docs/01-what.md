# WHAT: Bulkhead Pattern

The Bulkhead Pattern isolates failures by partitioning resources into separate pools. If one pool is exhausted or fails, the others continue to function.

## Core Responsibilities

1. **Isolation**: Separate resources for different types of work.
2. **Limiting**: Enforce maximum capacity per pool.
3. **Protection**: Prevent cascading failures from one workload to another.

## What This Project Does

This project implements a bulkhead that:

- Creates Pool A for critical user-facing requests
- Creates Pool B for background job processing
- Limits each pool to a maximum number of concurrent operations
- Rejects requests when a pool is full rather than queueing indefinitely

## Simplified Architecture

```
┌──────────┐
│ Critical │ ──▶ ┌───────┐
│ Request  │     │Pool A │ ──▶ Handled
└──────────┘     │(max 3)│
                 └───────┘

┌──────────┐
│Background│ ──▶ ┌───────┐
│   Job    │     │Pool B │ ──▶ Handled
└──────────┘     │(max 3)│
                 └───────┘
```

If Pool B is full, Pool A continues to accept requests.

## Key Terms

| Term | Definition |
|------|------------|
| Bulkhead | A partition that isolates resources to prevent failure propagation. |
| Pool | A limited set of resources dedicated to a specific workload. |
| Rejection | Returning an error immediately when a pool is at capacity. |
