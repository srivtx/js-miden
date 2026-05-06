# Setup Guide

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

## Installation

```bash
cd docs_js_backend/projects/advanced/A09-ml-serving
npm install
docker-compose up -d
npm run dev
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | API server port |
| MODEL_PATH | /models | Directory containing model files |
| NODE_ENV | development | Environment mode |
| REDIS_URL | redis://localhost:6379 | Redis for batch queue |

## Model Format

Models should be in ONNX, SavedModel, or PyTorch format:

```
models/
├── iris-v1.onnx
├── iris-v2.onnx
└── mnist-v1.onnx
```

## Registering Your First Model

```bash
curl -X POST http://localhost:3000/api/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iris-classifier",
    "version": "1.0.0",
    "path": "/models/iris-v1.onnx",
    "metadata": {
      "inputShape": [4],
      "outputShape": [3],
      "framework": "onnx"
    }
  }'
```

## Making Predictions

```bash
# Single prediction
curl -X POST http://localhost:3000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "iris-classifier",
    "input": [5.1, 3.5, 1.4, 0.2]
  }'

# Batch prediction
curl -X POST http://localhost:3000/api/predict/batch \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "iris-classifier",
    "inputs": [
      [5.1, 3.5, 1.4, 0.2],
      [4.9, 3.0, 1.4, 0.2]
    ]
  }'
```

## A/B Testing Setup

```bash
# Register v1
curl -X POST http://localhost:3000/api/models \
  -d '{ "name": "recommender", "version": "1.0.0", ... }'

# Register v2
curl -X POST http://localhost:3000/api/models \
  -d '{ "name": "recommender", "version": "2.0.0", ... }'

# Route 50% traffic to each version (client-side)
# Request specific version:
curl -X POST http://localhost:3000/api/predict \
  -d '{ "modelName": "recommender", "version": "2.0.0", ... }'
```

## Verification

```bash
# Run tests
npm test

# Check health
curl http://localhost:3000/api/health
```

## References

[1] ONNX Runtime Node.js API. https://onnxruntime.ai/docs/get-started/with-javascript.html
[2] TensorFlow.js Node.js Backend. https://www.tensorflow.org/js/guide/nodejs