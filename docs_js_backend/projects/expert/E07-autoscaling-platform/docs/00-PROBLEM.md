# Problem Statement

Build an auto-scaling platform controller modeled after Kubernetes Horizontal Pod Autoscaler (HPA). The system must collect application metrics, evaluate threshold-based scaling rules, decide whether to scale up or down while respecting cooldown periods, provide a predictive scaling stub using time-series forecasting, and optimize deployment cost via bin-packing workload placement.

## Functional Requirements

1. **Metrics Collection**: Ingest CPU, memory, and custom metrics via HTTP API.
2. **Threshold Rules**: Define scale-up and scale-down thresholds per workload.
3. **Cooldown**: Enforce a minimum duration between scaling actions to prevent thrashing.
4. **Predictive Scaling Stub**: Forecast future load using a simple moving average or linear regression stub.
5. **Cost Optimization**: Bin-pack workloads onto nodes to minimize cost (First-Fit Decreasing stub).
6. **HTTP API**: Express 5 endpoints for metrics submission, rule configuration, and scaling decisions.

## Non-Functional Requirements

- **Stability**: Must not flap (oscillate between scaling up and down).
- **Responsiveness**: Scale-up decisions should be immediate when load spikes.
- **Cost Efficiency**: Avoid over-provisioning.

## Known Defect (Intentional Bug)

The scaler uses a single threshold (e.g., 50%) for both scale-up and scale-down decisions. When load hovers around 50%, the controller scales up when slightly above and immediately scales down when slightly below, causing flapping. There is no hysteresis (deadband) between the two thresholds.

## Context

This project teaches control theory, time-series analysis, and operations research (bin packing) in the context of cloud-native infrastructure.
