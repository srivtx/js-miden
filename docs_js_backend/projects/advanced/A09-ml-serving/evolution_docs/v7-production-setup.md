# A09 Evolution: v7 — Production Setup

## State of the System

The ML model serving API is deployed as a GPU-enabled, auto-scaling Kubernetes service with S3 model storage, drift detection, and A/B testing.

## What Changed

- **Docker + Kubernetes.** `Dockerfile` uses `nvidia/cuda:12.0-base` for GPU support. `deployment.yaml` configures resource limits (`nvidia.com/gpu: 1`).
- **S3 model storage.** `ModelRegistryService` downloads models from S3 on first request. Models are cached locally in `/models`. Versioned S3 paths (`s3://models/iris/v1.0.0/model.onnx`) enable instant rollback.
- **GPU inference.** `onnxruntime-node` uses `executionProviders: ['cuda']`. Latency drops from 50 ms (CPU) to 5 ms (GPU).
- **Model caching.** `InferenceSession` objects are cached in a `Map`. Loading a model from S3 (10 seconds) happens once; subsequent requests reuse the session.
- **A/B testing.** `PredictionService` routes 5% of traffic to v2 via `Math.random() < 0.05`. Metrics are tagged with `version` for comparison.
- **Drift detection.** `MonitoringService` tracks prediction mean and standard deviation per model. Alerts fire if mean deviates > 20% from training baseline.
- **Prometheus + Grafana.** `prediction_latency_seconds`, `prediction_requests_total`, `model_load_duration_seconds`, `gpu_memory_usage_bytes`.
- **Kubernetes HPA.** Scales pods based on GPU utilization (> 80%) and request latency p99 (> 50 ms).
- **Batch queue.** Large batch jobs are queued in Redis. Workers process batches asynchronously and notify clients via webhook.

## What Still Breaks

- **No feature store.** Clients send raw features. Training/serving skew is possible if preprocessing differs.
- **No model explainability.** Predictions are black boxes. SHAP or LIME integration would explain individual predictions.
- **No adversarial robustness.** Malicious inputs can fool the model. Adversarial training or input sanitization is needed.
- **No multi-model serving.** One pod serves one model. Multi-model pods (NVIDIA Triton) would improve GPU utilization.

## Code Snapshot (deployment.yaml)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-serving
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ml-serving
  template:
    metadata:
      labels:
        app: ml-serving
    spec:
      containers:
        - name: api
          image: ml-serving:latest
          resources:
            limits:
              nvidia.com/gpu: 1
          env:
            - name: S3_BUCKET
              value: models-bucket
            - name: CUDA_VISIBLE_DEVICES
              value: "0"
```

## Architectural Notes

This is the "production" stage. The system now serves models at GPU speed with versioning, A/B testing, and drift detection. S3 storage enables instant rollback. Kubernetes HPA ensures throughput under load. However, the system lacks a feature store and model explainability.

## Future Work

1. Add Feast or Tecton feature store for consistent training/serving.
2. Integrate SHAP for prediction explainability.
3. Add adversarial input detection.
4. Deploy with NVIDIA Triton for multi-model GPU sharing.
