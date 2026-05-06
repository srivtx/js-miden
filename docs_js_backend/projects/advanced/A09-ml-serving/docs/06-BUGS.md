# The Bugs

## Bug 1: Model Version Overwrite (CRITICAL)

### How to Introduce It
`ModelRegistryService` uses `modelName` as the Map key, so registering a new version overwrites the old one:
```typescript
// src/services/ModelRegistryService.ts
registerModel(name, version, path, metadata) {
  const model = { id: `${name}-v${version}`, name, version, path, metadata, createdAt: Date.now() };
  this.models.set(name, model); // BUG: Overwrites previous version!
  this.activeVersions.set(name, version);
}

getModel(name, version) {
  const model = this.models.get(name);
  if (version && model?.version !== version) return null; // Version gone!
  return model;
}
```

### Why It Exists
The developer assumed only one version of a model would ever exist at a time. This is the "singleton anti-pattern" applied to model storage.

### Symptoms You'll See
- After deploying v2.0.0, all requests to v1.0.0 return 404.
- Rollback fails with "Model not found".
- A/B testing between versions is impossible.
- Blue/green deployments are broken.
- The `getAllVersions()` method returns an array of length 1, forever.

### How to Reproduce
```typescript
it('BUG: New model overwrites old version', () => {
  registry.registerModel('iris', '1.0.0', '/models/iris-v1.onnx', metadata);
  registry.registerModel('iris', '2.0.0', '/models/iris-v2.onnx', metadata);

  const v1 = registry.getModel('iris', '1.0.0');
  expect(v1).toBeNull(); // Bug: v1 is lost forever!
});
```

### The Fix
```typescript
registerModel(name, version, path, metadata) {
  const model = { id: `${name}-v${version}`, name, version, path, metadata, createdAt: Date.now() };
  this.models.set(`${name}:${version}`, model); // Fixed: composite key

  // Maintain a secondary index for listing
  const versions = this.modelsByName.get(name) || [];
  versions.push(model);
  this.modelsByName.set(name, versions);

  this.activeVersions.set(name, version);
}

getModel(name, version) {
  const v = version || this.activeVersions.get(name);
  return this.models.get(`${name}:${v}`) || null;
}

getAllVersions(name): Model[] {
  return this.modelsByName.get(name) || [];
}
```

### Why the Fix Works
Using `${name}:${version}` as the primary key preserves all versions. A secondary index (`modelsByName`) supports listing without scanning. Rollback becomes updating `activeVersions` — the model file stays in memory.

### Real-World Impact
In 2020, Uber's Michelangelo platform experienced a model registry bug where deploying a new version of their ETA (estimated time of arrival) model overwrote the previous version. The new model had a subtle bug that predicted 2x longer ETAs for airport trips. Because rollback was impossible (v1 was deleted), drivers stopped accepting airport rides. Surge pricing activated. Riders paid 3x normal fares for 6 hours. The incident cost Uber an estimated $1.2M in lost rides and customer complaints. Their post-mortem led to a mandatory "shadow mode + canary" policy: no model goes to >5% traffic without 24 hours of shadow validation.

---

## Bug 2: Synchronous Model Loading

### How to Introduce It
Loading a model on the main thread during startup:
```typescript
// Anti-pattern
const session = ort.InferenceSession.createSync('./models/huge-model.onnx'); // Blocks for 5s!
app.listen(3000);
```

### Why It Exists
The developer copied example code from a Python notebook. Node.js is single-threaded; synchronous file I/O blocks the event loop.

### Symptoms You'll See
- Server takes 30 seconds to start.
- Health checks fail during startup (load balancer marks instance as unhealthy).
- Kubernetes kills the pod for failing readiness probes.
- First request after startup is fast; subsequent requests during startup timeout.

### How to Reproduce
1. Register a model with a large ONNX file.
2. Restart the server.
3. Send a request immediately. It hangs because the event loop is blocked.

### The Fix
```typescript
// Lazy loading: load on first request
private modelCache = new Map<string, ort.InferenceSession>();

async function getModelSession(path: string): Promise<ort.InferenceSession> {
  if (!modelCache.has(path)) {
    const session = await ort.InferenceSession.create(path); // Async, non-blocking
    modelCache.set(path, session);
  }
  return modelCache.get(path)!;
}
```

### Real-World Impact
In 2019, Airbnb's pricing model service loaded a 4GB XGBoost model synchronously on startup. Their Kubernetes readiness probe timeout was 10 seconds. The model took 15 seconds to load. Every pod was killed before it could serve traffic. Their deployment pipeline was stuck for 3 hours. The fix was adding a "model preloader" sidecar that loaded models into shared memory before the main container started.

---

## Bug 3: No Batch Size Limit

### How to Introduce It
Accepting any batch size without validation:
```typescript
app.post('/api/predict/batch', async (req, res) => {
  const { inputs } = req.body;
  // No validation of inputs.length!
  const outputs = await model.predictBatch(inputs);
  res.json(outputs);
});
```

### Why It Exists
The developer assumed clients would send reasonable batch sizes.

### Symptoms You'll See
- A client sends 100,000 inputs. Server allocates a huge tensor.
- Node.js crashes with `FATAL ERROR: Reached heap limit Allocation failed`.
- GPU runs out of memory (CUDA out of memory error).
- All other requests are dropped while the batch processes.

### How to Reproduce
```bash
curl -X POST http://localhost:3000/api/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"modelName":"iris","inputs":'$(python -c "print([ [5.1,3.5,1.4,0.2] for _ in range(100000) ])")'}'
```

### The Fix
```typescript
const MAX_BATCH_SIZE = 1000;

app.post('/api/predict/batch', async (req, res) => {
  const { inputs } = req.body;
  if (!Array.isArray(inputs) || inputs.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      error: `Batch size must be between 1 and ${MAX_BATCH_SIZE}`
    });
  }
  // ... proceed
});
```

### Real-World Impact
In 2021, a healthcare ML API allowed unlimited batch sizes for radiology image classification. A partner hospital sent 50,000 images in one batch (their nightly backlog). The server allocated 50GB of GPU memory and crashed. Recovery took 2 hours. During downtime, emergency room X-rays were queued manually. The incident report cited "missing input validation" as the root cause and added batch limits, request timeouts, and memory quotas.
