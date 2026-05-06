# A09 Evolution: v5 — Add Testing

## State of the System

The model serving API is covered by Vitest. Tests verify model registration, prediction accuracy, batch throughput, monitoring metrics, and the intentional version-overwrite bug.

## What Changed

- **Unit tests for services.**
  - `model.test.ts` — verifies registration, retrieval, and the overwrite bug.
  - `prediction.test.ts` — verifies shape validation, latency tracking, and output generation.
  - `batch.test.ts` — verifies batch submission, progress tracking, and batch size limits.
  - `monitoring.test.ts` — verifies health, metrics computation, and per-model request counts.
- **Integration tests for routes.**
  - `POST /api/models` → returns 201 with model metadata.
  - `GET /api/models/:name` → returns 404 if not found.
  - `POST /api/predict` → returns prediction with latency.
  - `POST /api/predict/batch` → returns batch results with `batchSize`.
  - `GET /api/metrics` → returns total requests, errors, average latency, and PPM.
- **Bug reproduction tests.**
  - `overwrite.test.ts` — registers v1, registers v2, and asserts that `getModel('iris', '1.0.0')` returns `null`.
  - `rollback.test.ts` — asserts that `rollbackModel('iris', '1.0.0')` returns `false` after v2 overwrites v1.
  - `batch-overflow.test.ts` — sends 1,001 inputs and asserts HTTP 400.

## What Still Breaks

- **Model overwrite is documented but not fixed.** The test asserts the bug. A fix would use composite keys (`${name}:${version}`) and a secondary index.
- **No A/B testing tests.** The `selectVersion()` function is not tested. A canary rollout (5% traffic to v2) is not implemented.
- **No ONNX Runtime tests.** The system uses mock inference (`Math.random()`). There is no test that loads an actual `.onnx` file.
- **No drift detection tests.** The monitoring service tracks latency but not prediction distributions.

## Code Snapshot (tests/model.test.ts)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistryService } from '../src/services/ModelRegistryService.js';

describe('model registry', () => {
  let registry: ModelRegistryService;

  beforeEach(() => {
    registry = new ModelRegistryService();
  });

  it('registers a model', () => {
    const model = registry.registerModel('iris', '1.0.0', '/models/iris-v1', { inputShape: [4], outputShape: [3], framework: 'onnx' });
    expect(model.version).toBe('1.0.0');
  });

  it('BUG: new model overwrites old version', () => {
    registry.registerModel('iris', '1.0.0', '/models/iris-v1', { inputShape: [4], outputShape: [3], framework: 'onnx' });
    registry.registerModel('iris', '2.0.0', '/models/iris-v2', { inputShape: [4], outputShape: [3], framework: 'onnx' });
    const v1 = registry.getModel('iris', '1.0.0');
    expect(v1).toBeNull(); // Bug: v1 is lost forever
  });
});
```

## Architectural Notes

This is the "A/B testing + batching" stage. The test suite documents the registry bug that makes A/B testing impossible: if v2 overwrites v1, there is no way to route 5% of traffic to v2. The batch tests verify that large inputs are rejected, but they do not test vectorized inference (batching 100 inputs into one tensor operation). The monitoring tests verify latency but not prediction drift.

## Migration Path to v6

1. Switch to ES modules (`"type": "module"` in package.json) and update ONNX Runtime imports.
2. Fix the registry bug with composite keys and add `getAllVersions()`.
3. Add A/B testing logic: `if (Math.random() < 0.05) useV2()`.
4. Add drift detection: track prediction mean/std and alert on deviation.
