# API Reference

## Models

### POST /api/models
Register a new model version.

**Request:**
```json
{
  "name": "iris-classifier",
  "version": "1.0.0",
  "path": "/models/iris-v1.onnx",
  "metadata": {
    "inputShape": [4],
    "outputShape": [3],
    "framework": "onnx",
    "description": "Iris flower classifier"
  }
}
```

**Response:**
```json
{
  "id": "iris-classifier-v1.0.0",
  "name": "iris-classifier",
  "version": "1.0.0",
  "path": "/models/iris-v1.onnx",
  "metadata": { ... },
  "createdAt": 1704067200000
}
```

### GET /api/models
List all registered models.

**Response:**
```json
{
  "models": ["iris-classifier", "mnist-classifier"]
}
```

### GET /api/models/:name
Get model details.

### GET /api/models/:name/versions
Get all versions of a model.

### POST /api/models/:name/rollback
Rollback to a previous version.

**Request:**
```json
{ "version": "1.0.0" }
```

## Predictions

### POST /api/predict
Single prediction.

**Request:**
```json
{
  "modelName": "iris-classifier",
  "version": "1.0.0",
  "input": [5.1, 3.5, 1.4, 0.2]
}
```

**Response:**
```json
{
  "modelId": "iris-classifier-v1.0.0",
  "version": "1.0.0",
  "output": [0.1, 0.8, 0.1],
  "latencyMs": 12
}
```

### POST /api/predict/batch
Batch prediction.

**Request:**
```json
{
  "modelName": "iris-classifier",
  "version": "1.0.0",
  "inputs": [
    [5.1, 3.5, 1.4, 0.2],
    [4.9, 3.0, 1.4, 0.2]
  ]
}
```

**Response:**
```json
{
  "modelId": "iris-classifier-v1.0.0",
  "version": "1.0.0",
  "outputs": [[0.1, 0.8, 0.1], [0.2, 0.7, 0.1]],
  "latencyMs": 24,
  "batchSize": 2
}
```

## Monitoring

### GET /api/health
Server health status.

### GET /api/metrics
Metrics for all models.

### GET /api/metrics/:modelName
Metrics for specific model.

**Response:**
```json
{
  "totalRequests": 15000,
  "totalErrors": 23,
  "averageLatencyMs": 15.2,
  "predictionsPerMinute": 450
}
```

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid input shape | Input dimensions don't match model |
| 404 | Model not found | Model or version doesn't exist |
| 500 | Inference error | Model execution failed |

## References

[1] OpenAPI 3.0 Specification. https://swagger.io/specification/
[2] Express.js Request/Response API. https://expressjs.com/en/5x/api.html