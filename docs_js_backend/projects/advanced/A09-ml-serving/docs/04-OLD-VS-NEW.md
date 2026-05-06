# Old Ways vs New Ways (2015 vs 2025)

## Pattern 1: Model Deployment

### The Old Way (2010-2015)
```python
# Data scientist trains model
model = train_random_forest()
import pickle
pickle.dump(model, open('model.pkl', 'wb'))

# Engineer copies file to production server
# Model is loaded in a Flask app on startup
from flask import Flask
app = Flask(__name__)
model = pickle.load(open('model.pkl', 'rb'))

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    return jsonify(model.predict(data).tolist())
```
**Why we did it:** Simple. No infrastructure needed. Just copy a file.
**Why it's wrong now:** No versioning. No A/B testing. Pickle is a security risk (arbitrary code execution). Model loading blocks startup. No monitoring. Rollback requires SSHing into servers and manually replacing files.

### The New Way (2025)
```typescript
// Model is registered via API with metadata
await fetch('/api/models', {
  method: 'POST',
  body: JSON.stringify({
    name: 'iris-classifier',
    version: '2.0.0',
    path: '/models/iris-v2.onnx',
    metadata: { inputShape: [4], outputShape: [3], framework: 'onnx' }
  })
});

// Prediction API handles versioning, validation, and metrics automatically
const result = await fetch('/api/predict', {
  method: 'POST',
  body: JSON.stringify({ modelName: 'iris-classifier', input: [5.1, 3.5, 1.4, 0.2] })
});
```
**Why it's better:** Versioned, validated, monitored. Rollback is an API call. A/B testing is a config change. No SSH required.

### Migration Path
1. Convert all `.pkl` models to ONNX or SavedModel.
2. Build a model registry API.
3. Add input validation middleware.
4. Add Prometheus metrics.
5. Deploy with Kubernetes HPA (auto-scaling).

---

## Pattern 2: A/B Testing

### The Old Way
"Let's deploy the new model and see what happens."
```python
# Replace model file, restart server
# If it's bad, scramble to find the old file
```
**Why it's wrong:** No measurement. No rollback plan. If the model is bad, users suffer while engineers panic.

### The New Way
```typescript
// Shadow mode: v2 receives traffic but v1 serves responses
// Canary: 5% of traffic gets v2
// Full rollout: 100% traffic, v1 on standby
const useV2 = Math.random() < 0.05;
const model = useV2 ? registry.getModel('iris', '2.0.0') : registry.getModel('iris', '1.0.0');
```
**Why it's better:** Controlled risk. Measurable impact. Instant rollback.

---

## Pattern 3: Inference Optimization

### The Old Way
Pure Python inference with scikit-learn:
```python
# CPU-bound, single-threaded, no batching
result = model.predict([features])
```
**Why it's wrong:** 10-100x slower than optimized runtimes. No GPU support.

### The New Way
ONNX Runtime with batching:
```typescript
const session = new ort.InferenceSession('/models/iris-v2.onnx');
const tensor = new ort.Tensor('float32', batchInputs, [batchSize, 4]);
const results = await session.run({ input: tensor });
```
**Why it's better:** C++ backend, vectorized operations, GPU support (CUDA/TensorRT), 10-50x faster.

---

## Pattern 4: Monitoring

### The Old Way
Logs and prayers:
```python
print(f"Prediction took {time.time() - start}s")
```
**Why it's wrong:** Unstructured, unqueryable, no alerting. You only know the model is broken when users complain.

### The New Way
Structured metrics with alerts:
```typescript
// Prometheus metrics
predictionLatency.observe(latencyMs);
predictionCounter.inc();
if (latencyMs > 100) slowPredictionCounter.inc();

// AlertManager: alert if p99 latency > 50ms for 5 minutes
// AlertManager: alert if error rate > 0.1% for 2 minutes
```
**Why it's better:** Proactive alerting. Dashboards. Historical analysis.

---

## Pattern 5: Model Serving Architecture

### The Old Way
Monolithic Flask app with model embedded:
```
Flask App
  ├── Route handlers
  ├── Model loading (on startup)
  └── Business logic
```
**Why it's wrong:** Tight coupling. Can't scale model serving independently from API logic. One big model blocks startup for 30 seconds.

### The New Way
Microservice with sidecar or dedicated inference service:
```
API Gateway
  ├── /api/predict ──► Model Serving Pod (3 replicas)
  │                      └── ONNX Runtime
  ├── /api/models ──► Model Registry Service
  └── /api/batch ──► Batch Queue + Workers
```
**Why it's better:** Scale inference pods independently. Use GPU nodes for inference only. API gateway handles auth/rate-limiting.
