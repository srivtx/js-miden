# Architecture: Bulkhead Pattern

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Bulkhead Server :3000                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   Router    │  │   Bulkhead   │  │      Pools          │ │
│  │             │  │   Controller │  │  ┌─────┐ ┌─────┐   │ │
│  └─────────────┘  └──────────────┘  │  │PoolA│ │PoolB│   │ │
│                                     │  │max 3│ │max 3│   │ │
│                                     │  └─────┘ └─────┘   │ │
│                                     └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        ▲                                    ▲
        │ GET /critical                      │ GET /background
        │                                    │
┌───────┴───────┐                  ┌─────────┴─────────┐
│  Critical     │                  │  Background       │
│  Request      │                  │  Job              │
└───────────────┘                  └───────────────────┘
```

## Data Flow

1. Client sends `GET /critical`.
2. Router passes to Bulkhead Controller with pool name `critical`.
3. Controller checks Pool A capacity.
4. If capacity available, acquires slot and processes request.
5. If Pool A full, returns 503 immediately.
6. Background jobs follow the same flow with Pool B.
7. Pool exhaustion in B must not affect A.

## State Management

- `Pool` class tracks `max` and `active` counters
- No queues; requests are either accepted or rejected immediately
- Pools are completely independent objects

## Isolation Guarantee

```
Pool A: active=0, max=3  →  /critical accepted
Pool B: active=3, max=3  →  /background rejected

Result: /critical STILL accepted because pools are separate
```
