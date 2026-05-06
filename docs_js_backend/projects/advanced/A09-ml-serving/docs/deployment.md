# Deployment Guide

## Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
docker build -t a09-ml-serving .
docker-compose up -d
```

## Services in docker-compose

| Service | Purpose |
|---------|---------|
| api | Main prediction API |
| model-registry | Model metadata management |
| batch-worker | Async batch processing |
| redis | Job queue |
| prometheus | Metrics collection |

## GPU Support (NVIDIA)

For GPU inference with ONNX Runtime:

```yaml
services:
  api:
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
```

## Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-serving
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: a09-ml-serving:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
        - name: models
          mountPath: /models
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: models-pvc
```

## Scaling Strategies

| Strategy | When to Use |
|----------|-------------|
| Horizontal Pod Autoscaler | CPU > 70% |
| GPU Node Pool | Deep learning models |
| Model Cache | Keep hot models in memory |
| Request Batching | High throughput scenarios |

## Monitoring

Prometheus metrics:
- `ml_predictions_total`
- `ml_prediction_latency_seconds`
- `ml_model_load_duration_seconds`
- `ml_batch_queue_size`

## References

[1] Kubernetes HPA for ML Workloads. https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
[2] NVIDIA GPU Operator. https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/overview.html