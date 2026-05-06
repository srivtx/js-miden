# The Problem

## What Are We Building?
A production-grade ML model serving API that loads machine learning models and serves predictions via HTTP. Supports model versioning, A/B testing between versions, batch inference for throughput, and real-time monitoring of latency and error rates.

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

## Why Does This Problem Exist?
Training a model is only half the battle. Deploying it at scale requires:
- **Versioning**: Data scientists iterate weekly. Each iteration is a new model version. Serving the wrong version costs money.
- **A/B Testing**: Is v2 actually better than v1? Route 10% of traffic to v2 and measure business metrics.
- **Batch Inference**: A single prediction has high overhead (model loading, GPU context switching). Batch 100 inputs together for 10x throughput.
- **Monitoring**: Model performance degrades over time (data drift). Track latency, error rate, and prediction distributions.

Without a serving layer, data scientists hand `.pkl` files to engineers who manually copy them into Docker images. Rollbacks take hours. A/B testing is impossible.

## Who Will Use It?
- **Data Scientists**: Register new models, monitor drift, compare versions.
- **Product Engineers**: Call the prediction API from their microservices.
- **Mobile Apps**: Send user features, receive recommendations or classifications.
- **MLOps Engineers**: Scale the serving layer, manage GPU nodes, set up alerts.

## Constraints
- **Latency**: Single prediction < 50ms p99 (CPU) or < 10ms p99 (GPU)
- **Throughput**: 1,000+ predictions/second per instance via batching
- **Correctness**: Input shape validation before inference. Wrong inputs must fail fast.
- **Reliability**: Model loading must be async. A 2GB model should not block the event loop.
- **Version Safety**: Registering v2 must NOT delete v1. Rollback must be instant.

## What We're NOT Building
- We are NOT building the actual training pipeline (feature engineering, hyperparameter tuning)
- We are NOT building a feature store (assumes features are provided by the client)
- We are NOT building GPU optimization kernels (assumes ONNX Runtime or TensorFlow handles it)
- We are NOT building automated model retraining (drift detection only, not action)

## Real-World Context
In 2020, a major ride-sharing company deployed a new pricing model (v2) that overwrote the old model (v1) due to a registry bug. When v2 performed worse (5% revenue drop), rollback failed because v1 was deleted. They lost $3M in 4 hours before reverting via a manual database restore. This project teaches how to prevent that.
