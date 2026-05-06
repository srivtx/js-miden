# Architecture

## System Architecture

The ML Model Serving API uses a layered architecture with clear separation between model management, inference, and monitoring.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Express HTTP API                             │
│  POST /api/models    POST /api/predict    POST /api/predict/batch   │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Model      │    │  Prediction   │    │    Batch      │
│   Registry    │    │   Service     │    │   Service     │
│   Service     │    │               │    │               │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Model Storage Layer                           │
│  /models/iris-v1.onnx    /models/iris-v2.onnx    /models/mnist-v1   │
└─────────────────────────────────────────────────────────────────────┘
```

## Model Lifecycle

```
Register ──► Load ──► Validate ──► Serve ──► Monitor ──► Retire
   │          │          │           │          │          │
   ▼          ▼          ▼           ▼          ▼          ▼
 POST      Async     Shape      Predict     Metrics    Rollback
 /models   Load      Check      /predict    /metrics   /rollback
```

## A/B Testing Flow

1. Register Model v1.0.0 and v2.0.0
2. Client requests prediction with optional version
3. If no version specified, active version is used
4. Analytics track performance per version
5. Gradually shift traffic to better-performing model

## Data Flow

### Single Prediction
```
Client → POST /api/predict
  → PredictionService.validateInput()
  → ModelRegistry.getModel(name, version)
  → [Inference Engine]
  → PredictionService.trackMetrics()
  → JSON Response { output, latencyMs }
```

### Batch Prediction
```
Client → POST /api/predict/batch
  → BatchService.predictBatch()
  → PredictionService.predictBatch() (loop)
  → Aggregate outputs
  → JSON Response { outputs, latencyMs, batchSize }
```

## Deployment Architecture

```
                    ┌─────────────┐
                    │    API      │
                    │   Gateway   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  API Pod 1 │  │  API Pod 2 │  │  API Pod 3 │
    │  (models)  │  │  (models)  │  │  (models)  │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    ┌────────────┐
                    │   Redis    │
                    │   Queue    │
                    └────────────┘
```

## Scale Considerations

| Bottleneck | Solution |
|-----------|----------|
| Model Loading Time | Async loading, pre-warming |
| GPU Memory | Model sharding, batching |
| Throughput | Horizontal scaling, caching |
| Cold Start | Keep models loaded in memory |

## References

[1] "TensorFlow Serving: Flexible, High-Performance ML Serving," Google, 2017.
[2] "NVIDIA Triton Inference Server Architecture," NVIDIA, 2023.
[3] "ONNX Runtime Performance Tuning," Microsoft, 2023.