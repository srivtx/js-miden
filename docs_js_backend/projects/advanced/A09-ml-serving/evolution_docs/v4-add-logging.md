# A09 Evolution: v4 — Add Logging

## State of the System

Every prediction, batch job, and model registration is logged as structured JSON. Logs include model IDs, latency, input shapes, and batch sizes. The monitoring service exposes health and metrics endpoints.

## What Changed

- **Structured JSON logger.** `logInfo()` and `logError()` output single-line JSON with `level`, `message`, `timestamp`, and metadata.
- **Per-prediction logging.** `PredictionService.predict()` logs `modelId`, `latencyMs`, `inputLength`, and `outputLength` after every inference.
- **Batch job logging.** `BatchService.submitBatch()` logs `batchId`, `size`, and `status` (`processing` | `completed` | `failed`).
- **Model registration logging.** `ModelRegistryService.registerModel()` logs `modelId`, `version`, `path`, and `framework`.
- **Monitoring endpoints.** `GET /api/health` returns uptime. `GET /api/metrics` returns per-model request counts, error counts, average latency, and predictions per minute.

## What Still Breaks

- **Model overwrite is logged but not fixed.** The log shows `Registered iris-classifier@2.0.0`, but the previous version is silently gone. There is no log line for "Deleted iris-classifier@1.0.0".
- **No drift detection.** Metrics track latency and throughput, but not prediction distributions. A model outputting random numbers has the same metrics as a correct model.
- **No GPU utilization logging.** In a real ONNX Runtime setup, GPU memory usage and CUDA kernel time would be critical, but there is no integration.
- **No structured error classification.** All inference errors are logged as generic `Error` objects. Shape mismatches, model not found, and timeouts are indistinguishable.

## Code Snapshot (services/PredictionService.ts)

```typescript
async predict(request: PredictionRequest): Promise<PredictionResponse> {
  const startTime = Date.now();
  const model = this.registry.getModel(request.modelName, request.version);
  if (!model) {
    throw new Error(`Model not found: ${request.modelName}@${request.version || 'latest'}`);
  }
  this.validateInput(request.input, model);
  await this.simulateLatency();
  const output = this.computeOutput(request.input, model);
  const latencyMs = Date.now() - startTime;
  const modelId = `${request.modelName}-v${model.version}`;
  this.trackPrediction(modelId, latencyMs);
  logInfo('Prediction completed', { modelId, latencyMs, inputLength: request.input.length });
  return { modelId, version: model.version, output, latencyMs };
}
```

## Architectural Notes

This is the "monitoring" stage. The system now tracks operational metrics (latency, throughput, error rate) and exposes them via REST. An operator can query `GET /api/metrics` and see that `iris-classifier-v1.0.0` has served 10,000 requests with an average latency of 25 ms. However, the system does not track ML-specific metrics (prediction mean, standard deviation, feature drift), so model degradation is invisible.

## Migration Path to v5

1. Add Vitest tests for prediction accuracy, batch throughput, and registry rollback.
2. Track prediction distributions (mean, std, percentiles) and alert on deviation > 20% from baseline.
3. Add model caching so `InferenceSession` objects are loaded once and reused.
