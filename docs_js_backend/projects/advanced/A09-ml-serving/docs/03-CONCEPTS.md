# Concepts Explained

## Concept: Model Versioning

### WHAT Is It?
Tracking different iterations of a machine learning model with semantic versioning (MAJOR.MINOR.PATCH).

### WHY Do We Need It?
- **MAJOR**: Breaking changes (input/output shape changes, different feature requirements)
- **MINOR**: Backward-compatible improvements (new training data, hyperparameter tuning)
- **PATCH**: Bug fixes, retraining with same data distribution

Without versioning, deploying a new model is a "hope and pray" operation.

### HOW Does It Work?
```typescript
registry.registerModel('iris-classifier', '1.0.0', '/models/iris-v1.onnx', metadata);
registry.registerModel('iris-classifier', '2.0.0', '/models/iris-v2.onnx', metadata);
registry.getModel('iris-classifier', '1.0.0'); // Returns v1
registry.getModel('iris-classifier'); // Returns active version (v2)
```

### WRONG vs RIGHT

**WRONG** — Overwriting old versions:
```typescript
this.models.set(name, model); // BUG: key is just name!
// v1 is gone forever. Rollback impossible.
```

**RIGHT** — Composite key with version:
```typescript
this.models.set(`${name}:${version}`, model);
this.modelsByName.set(name, [...versions, model]);
this.activeVersions.set(name, version);
```

---

## Concept: A/B Testing for ML Models

### WHAT Is It?
Routing a percentage of traffic to a new model version and comparing performance metrics.

### WHY Do We Need It?
Offline metrics (accuracy, F1) don't guarantee business success. A model with 99% accuracy might have worse latency or recommend less profitable items.

### HOW Does It Work?
```
Phase 1: Shadow Mode
  v1 serves 100% of traffic
  v2 receives copies of v1's inputs but its outputs are DISCARDED
  Compare v1 vs v2 predictions without user impact

Phase 2: Canary (5% traffic)
  5% of real users see v2's predictions
  Monitor error rate, latency, business metrics
  If metrics degrade, instant rollback to v1

Phase 3: Full Rollout
  100% traffic to v2
  v1 remains registered for emergency rollback
```

### WRONG vs RIGHT

**WRONG** — Deploying v2 to 100% with no rollback plan:
```typescript
// Replace v1 with v2 globally
activeModel = loadModel('v2');
// v1 is deleted. If v2 is worse, you're stuck.
```

**RIGHT** — Gradual rollout with instant rollback:
```typescript
if (Math.random() < 0.05) {
  return v2.predict(input); // 5% canary
}
return v1.predict(input);
```

---

## Concept: Batch Inference

### WHAT Is It?
Processing multiple inputs in a single model forward pass.

### WHY Do We Need It?
GPU/CPU utilization is much higher with batches. The fixed overhead of memory allocation and kernel launch is amortized across many inputs.

### HOW Does It Work?
```typescript
// Single predictions (inefficient)
for (const input of inputs) {
  const output = model.predict(input); // 10ms each
}
// 100 inputs = 1000ms

// Batch prediction (efficient)
const outputs = model.predictBatch(inputs); // 50ms total
// 100 inputs = 50ms (20x faster)
```

### WRONG vs RIGHT

**WRONG** — Looping single predictions:
```typescript
const outputs = [];
for (const input of inputs) {
  outputs.push(await predictionService.predict({ modelName, input }));
}
```
This creates N separate function calls, N shape validations, and no vectorization.

**RIGHT** — Vectorized batch:
```typescript
const outputs = await predictionService.predictBatch(inputs, modelName, version);
```
The model runtime processes all inputs in one tensor operation.

---

## Concept: Monitoring ML Systems

### WHAT Is It?
Tracking operational metrics (latency, throughput, errors) AND ML-specific metrics (prediction distribution, data drift).

### WHY Do We Need It?
Models degrade over time. A fraud detection model trained in January might be useless by June because fraud patterns changed.

### HOW Does It Work?
```typescript
// Operational metrics
metrics.histogram('prediction_latency_ms', latencyMs);
metrics.counter('predictions_total', 1);
metrics.counter('prediction_errors_total', 1, { error_type });

// ML-specific metrics
metrics.gauge('prediction_mean', mean(outputs));
metrics.gauge('prediction_std', std(outputs));
// Alert if prediction_mean deviates > 20% from training baseline
```

### WRONG vs RIGHT

**WRONG** — Only tracking HTTP status codes:
```typescript
console.log(`Request took ${Date.now() - start}ms`);
```
This tells you the server is up but not whether the model is making sensible predictions.

**RIGHT** — Tracking prediction distributions and input drift:
```typescript
// Track feature distributions
for (let i = 0; i < input.length; i++) {
  metrics.gauge(`feature_${i}_mean`, input[i]);
}
// Alert if feature distributions shift
```
