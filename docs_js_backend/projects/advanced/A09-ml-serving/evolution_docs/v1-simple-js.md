# A09 Evolution: v1 — Simple JavaScript

## State of the System

The model serving API is a single Express route that loads a scikit-learn model via `pickle` and calls `model.predict()` synchronously. There is no registry, no versioning, and no monitoring. The model file is imported at the top of `index.js`.

## What Works

- `POST /predict` accepts a JSON array of features and returns the model output.
- The model is loaded once at startup and cached in a global variable.
- `console.log()` prints the request body for debugging.

## What Does NOT Work

- **No versioning.** When the data scientist hands over `model-v2.pkl`, the engineer overwrites `model.pkl` and restarts the server. If v2 is worse, rollback requires finding the old file in Git or a backup.
- **No input validation.** A request with `[1, 2]` instead of `[1, 2, 3, 4]` crashes the Python process with a `ValueError`. The Node.js wrapper shows a generic 500 with no detail.
- **Synchronous loading.** A 2 GB model blocks the event loop for 5–10 seconds on startup. Health checks fail; Kubernetes kills the pod before it is ready.
- **No batching.** A client sending 100 predictions loops 100 times, creating 100 Python IPC calls. Throughput is ~10 requests/second.
- **No monitoring.** We do not know latency, error rate, or prediction distribution. The model could be outputting nonsense, and we would only find out when users complain.

## Code Snapshot (index.js)

```javascript
const express = require('express');
const { spawnSync } = require('child_process');
const app = express();
app.use(express.json());

// Load model synchronously — blocks startup
const model = require('pickle').load('model.pkl');

app.post('/predict', (req, res) => {
  console.log(req.body);
  const result = model.predict(req.body.input); // may throw
  res.json({ output: result });
});

app.listen(3000);
```

## Architectural Notes

This is the "direct model load" stage. The model is treated as a static asset, not a versioned artifact. The serving layer is tightly coupled to the training framework (scikit-learn) and the serialization format (pickle, which is a security risk — arbitrary code execution on unpickle).

## Migration Path to v2

1. Replace pickle with ONNX — framework-agnostic, no arbitrary code execution.
2. Introduce TypeScript interfaces for `PredictionRequest` and `PredictionResponse`.
3. Extract model loading into an async `ModelRegistryService` so startup is non-blocking.
