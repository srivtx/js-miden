# A09 Evolution: v6 — Switch to ESM

## State of the System

The ML model serving API is now a pure ES module package. ONNX Runtime and model loaders are imported dynamically, reducing startup time.

## What Changed

- **`"type": "module"` in package.json.** All `.js` and `.ts` files are ES modules.
- **`.js` extensions on all relative imports.** `import { PredictionService } from './services/PredictionService.js'`.
- **Dynamic imports for ONNX Runtime.** `const ort = await import('onnxruntime-node');` loads the runtime only when a model is first requested.
- **Lazy model loading.** `PredictionService` caches `InferenceSession` objects. The first request for a model triggers async loading; subsequent requests reuse the cache.
- **`tsx` for development.** `tsx watch src/index.ts` runs the server in ESM mode.

## What Still Breaks

- **Model overwrite is not fixed by ESM.** The registry still uses `name` as the Map key.
- **No GPU support.** `onnxruntime-node` uses CPU by default. ESM enables dynamic import of `onnxruntime-node` with CUDA provider, but it is not configured.
- **No model versioning in paths.** Models are referenced by string paths. There is no S3 integration or signed URL support.
- **No Kubernetes HPA.** The server is a single process. ESM does not change deployment topology.

## Code Snapshot (package.json)

```json
{
  "name": "a09-ml-serving",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^5.0.0",
    "zod": "^3.0.0",
    "onnxruntime-node": "^1.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

## Architectural Notes

This is the "ESM + ONNX" stage. ES modules enable tree-shaking of unused framework code and dynamic loading of execution providers. A GPU-enabled deployment can import `onnxruntime-node` with `executionProviders: ['cuda']` only on instances with GPUs. However, the registry is still broken, and there is no autoscaling.

## Migration Path to v7

1. Add Docker with GPU support (`nvidia-docker2`) for CUDA inference.
2. Fix the registry bug with composite keys and add S3 model storage.
3. Add Kubernetes HPA based on GPU utilization and request latency.
4. Add drift detection alerts via Prometheus Alertmanager.
