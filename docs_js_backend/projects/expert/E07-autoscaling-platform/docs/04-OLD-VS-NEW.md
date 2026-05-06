# Old vs New: 2015 vs 2025

## 2015 – Manual & Reactive

- **Scaling**: Human operators watched dashboards and manually changed instance counts.
- **Rules**: Static cron schedules ("scale to 10 at 9 AM").
- **Metrics**: Basic CloudWatch / Ganglia, 1-minute granularity.
- **Containers**: VMs or bare metal; no orchestrator.
- **Latency**: Minutes to provision.
- **Cost**: Over-provisioned "just in case."

## 2025 – Intelligent & Predictive

- **Scaling**: Kubernetes HPA + VPA + KEDA + Cluster Autoscaler.
- **Rules**: Event-driven scaling (Kafka lag, SQS queue depth), custom metrics via Prometheus Adapter.
- **Metrics**: eBPF-based, sub-second granularity, open telemetry.
- **Containers**: Serverless containers (Knative, AWS Fargate) + spot instances.
- **Latency**: Seconds to milliseconds (warm pools, snapshot restore).
- **Cost**: ML-driven cost optimization, spot preemption handling, carbon-aware scheduling.

## Key Shifts

| Dimension | 2015 | 2025 |
|-----------|------|------|
| Trigger | Time / CPU | Custom metrics, events, predictions |
| Speed | Minutes | Seconds |
| Granularity | VM-level | Pod / container-level |
| Intelligence | Reactive | Predictive + reactive |
| Cost model | Reserved capacity | Spot, on-demand, serverless mix |

## What Stayed the Same

- Control theory fundamentals (feedback, hysteresis, damping).
- Bin-packing as an NP-hard problem.
- The risk of flapping if thresholds are misconfigured.
