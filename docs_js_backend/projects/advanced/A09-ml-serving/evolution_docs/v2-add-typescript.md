# A09 Evolution: v2 — Add TypeScript

## State of the System

The model serving API has been refactored into typed services. The implicit data model of v1 is now explicit, and the compiler enforces correct shapes for predictions, batches, and registry entries.

## What Changed

- **Explicit domain types.**
  - `Model` — `id`, `name`, `version`, `path`, `metadata`, `createdAt`.
  - `ModelMetadata` — `inputShape`, `outputShape`, `framework`, `description?`.
  - `PredictionRequest` — `modelName`, `version?`, `input`.
  - `PredictionResponse` — `modelId`, `version`, `output`, `latencyMs`.
  - `BatchPredictionRequest` / `BatchPredictionResponse` — batch-sized inputs/outputs with `batchSize` and `latencyMs`.
  - `ModelMetrics` — `totalRequests`, `totalErrors`, `averageLatencyMs`, `predictionsPerMinute`.
- **Service decomposition.**
  - `ModelRegistryService` — registers models by name (but see v3 bug: overwrites previous versions).
  - `PredictionService` — validates input shape, simulates inference latency, tracks per-model metrics.
  - `BatchService` — submits and tracks batch jobs, delegates inference to `PredictionService`.
  - `MonitoringService` — computes health, prediction counts, and latency averages.
- **Input shape validation.** `PredictionService.validateInput()` checks that a single input matches `metadata.inputShape[0]` and that batch inputs match `metadata.inputShape[1]`.

## What Still Breaks

- **No runtime validation of registration payloads.** A POST to `/api/models` with `metadata: null` compiles (the route handler is typed) but crashes at runtime when `validateInput` tries to read `metadata.inputShape`.
- **Model overwrite bug.** `ModelRegistryService` uses `modelName` as the `Map` key. Registering `iris-classifier@2.0.0` overwrites `iris-classifier@1.0.0`. Rollback is impossible; A/B testing is impossible.
- **No batch size limit.** A client can send 100,000 inputs. The server loops over all of them, allocating a huge output array. Node.js crashes with `FATAL ERROR: Reached heap limit`.
- **Synchronous model loading.** The default model (`iris-classifier@1.0.0`) is registered at startup. In a real system with ONNX Runtime, `InferenceSession.create()` would block the event loop for seconds.

## Code Snapshot (services/ModelRegistryService.ts)

```typescript
export class ModelRegistryService {
  private models: Map<string, Model> = new Map(); // key is modelName (BUG: should be name:version)
  private activeVersions: Map<string, string> = new Map();

  registerModel(name: string, version: string, path: string, metadata: ModelMetadata): Model {
    const model: Model = { id: `${name}-v${version}`, name, version, path, metadata, createdAt: Date.now() };
    this.models.set(name, model); // BUG: overwrites previous version
    this.activeVersions.set(name, version);
    return model;
  }
}
```

## Architectural Notes

This is the "versioning" stage — or rather, the *illusion* of versioning. The type system makes versioning look safe, but the runtime implementation is a singleton map per model name. The `PredictionService` is ready for real ONNX inference (it already validates shapes and simulates latency), but the registry cannot support multiple versions, so A/B testing and canary deployments are blocked.

## Migration Path to v3

1. Fix the registry bug by using composite keys (`${name}:${version}`) and a secondary index for listing.
2. Add Zod schemas for model registration and prediction requests.
3. Enforce `MAX_BATCH_SIZE` (e.g., 1,000) to prevent memory exhaustion.
