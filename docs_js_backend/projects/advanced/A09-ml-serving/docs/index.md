# A09: ML Model Serving

## Overview

A production-grade ML model serving API that loads machine learning models and serves predictions via HTTP. Supports model versioning, A/B testing, and batch inference [1].

## What This Project Does

- **Model Registry**: Register and manage multiple ML models
- **Versioning**: Track different versions of the same model
- **A/B Testing**: Route traffic between model versions
- **Batch Inference**: Process multiple predictions in one request
- **Monitoring**: Track latency, throughput, and error rates

## Architecture

```
┌─────────────┐      POST /api/predict      ┌─────────────────┐
│   Client    │────────────────────────────►│  ML Model API   │
│  (Mobile/   │                             │   (Express 5)   │
│   Web App)  │◄────────────────────────────│                 │
└─────────────┘     Prediction + Metrics    └────────┬────────┘
                                                     │
        ┌────────────────────┬───────────────────────┼───────────────────┐
        ▼                    ▼                       ▼                   ▼
┌──────────────┐   ┌────────────────┐   ┌──────────────────┐   ┌──────────────┐
│   Model      │   │   Prediction   │   │     Batch        │   │  Monitoring  │
│  Registry    │   │   Service      │   │    Service       │   │   Service    │
└──────────────┘   └────────────────┘   └──────────────────┘   └──────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐   ┌────────────────┐
│  v1.0.0:     │   │  v2.0.0:       │
│ /models/iris │   │ /models/iris   │
│   -v1.onnx   │   │   -v2.onnx     │
└──────────────┘   └────────────────┘
```

## Key Design Decisions

1. **Model Versioning**: Each model registration includes a semantic version [2].
2. **Input Validation**: All predictions validate input shapes before inference.
3. **Async Loading**: Models load asynchronously to prevent blocking.
4. **Batch Processing**: Batches are processed efficiently in a single pass.

## Services

| Service | Responsibility |
|---------|---------------|
| ModelRegistryService | Store, retrieve, and version models |
| PredictionService | Run inference, validate inputs, track latency |
| BatchService | Queue and process batch prediction jobs |
| MonitoringService | Collect metrics, health checks |

## Known Issues

See [troubleshooting.md](troubleshooting.md) for the model versioning bug.

## References

[1] "TensorFlow Serving Architecture," TensorFlow, 2023. https://www.tensorflow.org/tfx/serving/architecture
[2] "Semantic Versioning 2.0.0," semver.org. https://semver.org/
[3] "ML Model Management: A Comprehensive Guide," Google Cloud, 2022.