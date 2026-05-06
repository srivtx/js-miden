# 08-CRITIQUE: Bulkhead Pattern

## WHAT would a senior engineer say?

This project has the **right idea but the wrong implementation**. It defines a pool and uses acquire/release semantics, but the fatal flaw is that all workload types share a single pool. A bulkhead with one compartment is not a bulkhead.

## WHY is this critique necessary?

The bulkhead pattern is subtle. Developers often think "I have a pool with a limit, so I have a bulkhead." But without **isolation between workload types**, the pool is just a global semaphore that can be exhausted by any caller.

## HOW would a senior engineer fix this?

### 1. Fix Pool Isolation Immediately

**Current:** `const sharedPool = new Pool('shared', 3);`
**Critique:** This is the core bug. The `poolName` parameter is ignored.
**Fix:** Create a map of pools keyed by workload type.

### 2. Add Per-Pool Metrics

**Current:** `getPoolStatus()` returns global status only.
**Critique:** You can't tune what you can't measure.
**Fix:** Return status per pool and export Prometheus metrics:

```typescript
// Metrics
bulkhead_pool_active{pool="critical"} 8
bulkhead_pool_max{pool="critical"} 10
bulkhead_pool_rejected_total{pool="background"} 42
```

### 3. Add Queue Wait Timeouts

**Current:** Rejection is immediate if pool is full.
**Critique:** Immediate rejection is correct for bulkheads, but some use cases need a small queue with a timeout.
**Fix:** Optionally allow `maxQueue: 5` and `queueTimeout: 1000ms` for non-critical workloads.

### 4. Use a Library

**Current:** Custom `Pool` class.
**Critique:** Reinventing the wheel; easy to miss edge cases.
**Fix:** Use `p-limit` for Node.js, `Resilience4j` for JVM, or `Polly` for .NET.

### 5. Infrastructure-Level Bulkheads

**Current:** Application-level semaphore.
**Critique:** Doesn't protect against CPU or memory exhaustion.
**Fix:** Use Kubernetes resource quotas, cgroups, or service mesh connection pools for comprehensive isolation.

### 6. Document Pool Limits

**Current:** Limits are hardcoded.
**Critique:** Every environment has different capacity.
**Fix:** Load limits from environment variables or config:

```bash
BULKHEAD_CRITICAL_MAX=20
BULKHEAD_BACKGROUND_MAX=10
```

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Senior Review) |
|--------|-----------------|-----------------------|
| Pool count | 1 shared pool | N named pools |
| Metrics | Global only | Per-pool Prometheus metrics |
| Queueing | None (correct for bulkhead) | Optional bounded queue for non-critical |
| Implementation | Custom Pool class | `p-limit` or `async-sema` |
| Infrastructure | App-only | K8s quotas + service mesh |
| Configuration | Hardcoded | Environment variables |

## ASCII Diagram: Production Bulkhead

```
Incoming Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Routing Layer                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Critical    │  │ Background  │  │   Analytics         │  │
│  │ Route       │  │ Route       │  │   Route             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                      │             │
│         ▼                ▼                      ▼             │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐           │
│  │ Pool A    │    │ Pool B    │    │ Pool C    │           │
│  │ max: 20   │    │ max: 10   │    │ max: 5    │           │
│  │ (p-limit) │    │ (p-limit) │    │ (p-limit) │           │
│  └─────┬─────┘    └─────┬─────┘    └─────┬─────┘           │
│        │                │                │                  │
│        ▼                ▼                ▼                  │
│    Handler A        Handler B        Handler C              │
└─────────────────────────────────────────────────────────────┘
```

## Final Verdict

**Grade: B for concept understanding, D for implementation.**

The acquire/release pattern and the rejection logic are correct. However, the shared pool defeats the entire purpose. Fix the isolation, add metrics, and then consider whether a library or infrastructure solution is more appropriate than custom code.
