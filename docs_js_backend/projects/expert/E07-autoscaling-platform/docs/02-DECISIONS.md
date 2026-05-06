# Design Decisions

## Reactive vs Predictive Scaling

| Approach | Pros | Cons | When to Use |
|----------|------|------|-------------|
| **Reactive** (threshold-based) | Simple, fast to implement, works for step changes | Lags behind traffic; always catching up | Burst traffic, short-lived spikes |
| **Predictive** (time-series) | Proactive, smooth transitions | Needs history, can be wrong, complex | Diurnal patterns, scheduled events |

**Decision**: Implement both. The core loop is reactive (fast, safe). A predictive stub provides a forecast that could feed into a feed-forward term.

## Threshold vs ML-Based Control

| Approach | Pros | Cons |
|----------|------|------|
| **Threshold** | Deterministic, explainable, low compute | Binary decisions, requires tuning |
| **ML / RL** | Can optimize for cost+latency jointly | Black box, training data, drift, latency |

**Decision**: Use thresholds for the production path. Add a predictive stub to demonstrate the concept without the operational burden of a model.

## Bin-Packing Algorithm

| Algorithm | Approximation Ratio | Complexity | Notes |
|-----------|---------------------|------------|-------|
| First-Fit (FF) | 1.7 OPT | O(n²) | Simple, online |
| First-Fit Decreasing (FFD) | 1.22 OPT | O(n log n) | Sort first, better packing |
| Best-Fit Decreasing (BFD) | 1.22 OPT | O(n log n) | Tries to fill gaps |
| Exact (MILP) | 1.0 OPT | NP-hard | Impractical at scale |

**Decision**: FFD is the classic choice for educational code and matches many real scheduler implementations.

## Centralized vs Decentralized

- **Centralized** (HPA per namespace): Easier to reason about, global view.
- **Decentralized** (sidecar per pod): Faster reaction, but risk of thundering herd.

**Decision**: Centralized controller with per-workload state.
