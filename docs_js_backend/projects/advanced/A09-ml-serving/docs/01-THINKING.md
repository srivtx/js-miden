# Thinking Process

## Mental Models

Think of the model serving system as a **restaurant**:

```
Model Registry = The Pantry
  - Stores all ingredients (model weights) organized by recipe (model name) and batch (version)
  - v1.0.0 = flour from last month
  - v2.0.0 = flour from this week

Prediction Service = The Kitchen
  - Takes an order (input features)
  - Fetches the right ingredients (model weights) from the pantry
  - Cooks the dish (runs inference)
  - Returns the plate (prediction output)
  - Times every order (latency tracking)

Batch Service = Catering
  - Instead of 100 individual orders, takes 1 big order
  - Cooks all dishes in one batch (vectorized inference)
  - Much faster per dish, slightly slower for the first one

Monitoring Service = The Health Inspector
  - Watches kitchen temperature (latency)
  - Counts spoiled dishes (errors)
  - Notices when ingredients go bad (model drift)
```

## The Hot Path

Single prediction is the most common request:
```
Client ──REST──► API
  → PredictionService.predict()
    → ModelRegistry.getModel(name, version)     ──► 1ms
    → validateInput(shape check)                ──► 0.1ms
    → simulate inference (or ONNX Runtime)      ──► 12ms
    → trackMetrics(latency)                     ──► 0.1ms
  → JSON Response { output, latencyMs }
```

**Target SLA**: < 50ms p99 for CPU inference, < 10ms p99 for GPU.

## The Danger Zone

1. **Model Overwrite Bug**: `ModelRegistryService` uses `modelName` as the Map key. Registering v2 overwrites v1. Rollback is impossible. A/B testing is impossible.
2. **Synchronous Model Loading**: Loading a 2GB ResNet model blocks the event loop for 5+ seconds. All concurrent requests timeout.
3. **No Input Validation**: A client sends `[1, 2]` instead of `[1, 2, 3, 4]`. The model crashes with a shape mismatch. The error is a 500 instead of a 400.
4. **Batch Queue Overflow**: Unlimited batch size. A client sends 100,000 inputs. Server runs out of memory.

## Question Everything

- **Why not just load the model on every request?** Model loading is slow (seconds). It must happen once at startup or lazily on first request, then cached in memory.
- **Why ONNX instead of PyTorch directly?** ONNX is framework-agnostic. A model trained in PyTorch, TensorFlow, or scikit-learn can all be converted to ONNX and served by the same runtime.
- **Why batch if latency matters?** Batch increases throughput (requests/second) at the cost of per-request latency. Use single prediction for real-time, batch for offline jobs.
- **What if the model is too big for one machine?** Model sharding (split layers across GPUs) or model parallelism. Out of scope for this project but critical for LLMs.

## The "What If" Game

- **What if v2 is worse than v1?** Instant rollback to v1 by updating `activeVersions`. The API continues serving without restart.
- **What if input features drift?** Track prediction distributions. If the mean of feature-3 shifts by > 2 standard deviations, alert the data science team.
- **What if GPU memory is full?** Use model swapping (unload cold models, load hot ones). Or use NVIDIA Triton's multi-model scheduling.
- **What if two requests hit the same model simultaneously?** ONNX Runtime is thread-safe. Concurrent inference is fine. But GPU context switching has overhead — batching reduces it.
