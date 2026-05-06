# Step-by-Step Build Guide

## Step 1: Model Registration

```typescript
// POST /api/models
app.post('/api/models', (req, res) => {
  const { name, version, path, metadata } = req.body;

  // Validate required fields
  if (!name || !version || !path) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate semantic version format
  if (!semver.valid(version)) {
    return res.status(400).json({ error: 'Invalid semantic version' });
  }

  const model = registry.registerModel(name, version, path, metadata);
  res.status(201).json(model);
});
```

### Common Mistakes
- **Mistake**: Not validating input shape metadata at registration time.
- **Why it breaks**: A model with `inputShape: null` will crash on the first prediction.
- **How to avoid**: Require `inputShape` and `outputShape` in metadata. Validate they're arrays of positive integers.

---

## Step 2: Single Prediction Endpoint

```typescript
// POST /api/predict
app.post('/api/predict', async (req, res) => {
  try {
    const { modelName, version, input } = req.body;
    const result = await predictionService.predict({ modelName, version, input });
    res.json(result);
  } catch (error) {
    if (error.message.includes('Model not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Invalid input shape')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Inference failed' });
  }
});
```

### Common Mistakes
- **Mistake**: Not catching model loading errors.
- **Why it breaks**: If the model file is corrupted, the server crashes instead of returning a 500 error.
- **How to avoid**: Wrap `session.run()` in try/catch. Return structured errors.

---

## Step 3: Input Validation

```typescript
private validateInput(input: number[] | number[][], model: Model): void {
  const expectedShape = model.metadata.inputShape;

  if (Array.isArray(input[0])) {
    // Batch input
    const batchInput = input as number[][];
    if (batchInput[0].length !== expectedShape[1]) {
      throw new Error(`Invalid input shape: expected [*, ${expectedShape[1]}], got [*, ${batchInput[0].length}]`);
    }
  } else {
    // Single input
    const singleInput = input as number[];
    if (singleInput.length !== expectedShape[0]) {
      throw new Error(`Invalid input shape: expected [${expectedShape[0]}], got [${singleInput.length}]`);
    }
  }
}
```

### Common Mistakes
- **Mistake**: Validating shape only on the first request.
- **Why it breaks**: Subsequent requests with different shapes crash the model.
- **How to avoid**: Validate on EVERY request. The overhead is microseconds.

---

## Step 4: Batch Processing

```typescript
// POST /api/predict/batch
app.post('/api/predict/batch', async (req, res) => {
  try {
    const { modelName, version, inputs } = req.body;

    // Limit batch size to prevent memory exhaustion
    if (inputs.length > 1000) {
      return res.status(400).json({ error: 'Batch size exceeds maximum of 1000' });
    }

    const result = await batchService.predictBatch({ modelName, version, inputs });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Common Mistakes
- **Mistake**: Not limiting batch size.
- **Why it breaks**: A malicious client sends 1,000,000 inputs. Server runs out of memory and crashes.
- **How to avoid**: Enforce `MAX_BATCH_SIZE` (e.g., 1000). Return 400 if exceeded.

---

## Step 5: Async Model Loading

```typescript
async function loadModelAsync(path: string): Promise<ort.InferenceSession> {
  // Load model in background to avoid blocking event loop
  return new Promise((resolve, reject) => {
    setImmediate(async () => {
      try {
        const session = await ort.InferenceSession.create(path);
        resolve(session);
      } catch (error) {
        reject(error);
      }
    });
  });
}
```

### Common Mistakes
- **Mistake**: Loading model synchronously on startup.
- **Why it breaks**: A 2GB model blocks the Node.js event loop for 5+ seconds. The server is unresponsive during startup.
- **How to avoid**: Use lazy loading (load on first request) or async loading with a "warming" phase.

---

## Step 6: Monitoring Setup

```typescript
// Track every prediction
private trackPrediction(modelId: string, latencyMs: number): void {
  const count = this.predictions.get(modelId) || 0;
  this.predictions.set(modelId, count + 1);

  const latencies = this.latencies.get(modelId) || [];
  latencies.push(latencyMs);
  if (latencies.length > 1000) latencies.shift(); // Rolling window
  this.latencies.set(modelId, latencies);

  // Alert if latency spikes
  if (latencyMs > 100) {
    console.warn(`High latency for ${modelId}: ${latencyMs}ms`);
  }
}
```

---

## Step 7: A/B Testing Setup

```typescript
// Client requests prediction
// If no version specified, use active version
// For canary: 5% chance of using v2

function selectVersion(modelName: string, requestedVersion?: string): string {
  if (requestedVersion) return requestedVersion;

  const activeVersion = registry.getActiveVersion(modelName);
  const v2 = registry.getModel(modelName, '2.0.0');

  // Canary: 5% of traffic to v2 if it exists
  if (v2 && Math.random() < 0.05) {
    return '2.0.0';
  }

  return activeVersion || '1.0.0';
}
```
