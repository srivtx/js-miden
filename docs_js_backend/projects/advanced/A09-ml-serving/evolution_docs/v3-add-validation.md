# A09 Evolution: v3 — Add Validation

## State of the System

Every prediction request and model registration is validated at runtime. The system rejects malformed inputs before they reach inference logic, preventing shape-mismatch crashes and invalid model metadata.

## What Changed

- **Zod schemas for model registration.**
  - `registerSchema` — `name: z.string().min(1)`, `version: z.string().regex(/^\d+\.\d+\.\d+$/)`, `path: z.string().min(1)`, `metadata: z.object({ inputShape: z.array(z.number().int().positive()), outputShape: z.array(z.number().int().positive()), framework: z.enum(['tensorflow', 'pytorch', 'onnx']), description: z.string().optional() })`.
- **Zod schemas for prediction.**
  - `predictSchema` — `modelName: z.string().min(1)`, `version: z.string().optional()`, `input: z.array(z.number()).or(z.array(z.array(z.number())))`.
  - `batchPredictSchema` — `modelName: z.string().min(1)`, `version: z.string().optional()`, `inputs: z.array(z.array(z.number())).max(1000)`.
- **Batch size enforcement.** `inputs.length` must be ≤ 1,000. A client sending 100,000 inputs receives HTTP 400 before any allocation.
- **Semantic version validation.** `version` must match `MAJOR.MINOR.PATCH`. This prevents registration of `"latest"` or `"v2"`, which would break registry lookup.

## What Still Breaks

- **Model overwrite bug persists.** Valid registration payloads still overwrite previous versions because the registry key is `name`, not `name:version`.
- **No latency logging.** Validation errors are logged to `console.error`, but successful predictions produce no structured log.
- **No model caching.** Every prediction calls `registry.getModel()`, which returns a plain object. In a real ONNX system, the `InferenceSession` would be recreated on every request.
- **No drift detection.** The monitoring service tracks request counts and average latency, but it does not track prediction distributions or feature means.

## Code Snapshot (routes/index.ts)

```typescript
router.post('/models', (req, res) => {
  const registry = req.app.locals.registry;
  try {
    const { name, version, path, metadata } = registerSchema.parse(req.body);
    const model = registry.registerModel(name, version, path, metadata);
    res.status(201).json(model);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/predict/batch', async (req, res) => {
  const batchService = req.app.locals.batchService;
  try {
    const parsed = batchPredictSchema.parse(req.body);
    const result = await batchService.predictBatch(parsed);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
```

## Architectural Notes

This is the "batching + validation" stage. The system now enforces input shapes, batch sizes, and semantic versions at the API boundary. The `PredictionService` validates every request against `metadata.inputShape`, catching shape mismatches before mock inference. However, the registry is still a singleton map, so the A/B testing and rollback features described in the types are not achievable in practice.

## Migration Path to v4

1. Replace `console.log`/`console.error` with structured JSON logging that includes `modelId`, `latencyMs`, `inputShape`, and `batchSize`.
2. Fix the registry by using composite keys and adding `getAllVersions()`.
3. Add model session caching so `InferenceSession` objects are loaded once and reused.
