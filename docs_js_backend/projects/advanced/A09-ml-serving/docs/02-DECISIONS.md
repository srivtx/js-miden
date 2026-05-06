# Architecture Decisions

## Decision 1: Model Format

### Option A: ONNX (Open Neural Network Exchange)
**Pros:** Framework-agnostic (PyTorch, TensorFlow, scikit-learn → ONNX). Optimized runtimes for CPU/GPU. Industry standard.
**Cons:** Not all operations are supported. Complex models (transformers with custom layers) may not convert cleanly.

### Option B: TensorFlow SavedModel
**Pros:** Native to TensorFlow ecosystem. TensorFlow Serving is battle-tested at Google scale.
**Cons:** Locked into TensorFlow. Large model sizes. Complex dependency management.

### Option C: PyTorch TorchScript
**Pros:** Native to PyTorch. Dynamic shapes supported.
**Cons:** Requires libtorch. Less mature serving infrastructure than TensorFlow Serving.

### Option D: Custom Format (Pickle, HDF5)
**Pros:** Flexible, any Python object.
**Cons:** Security risk (arbitrary code execution on unpickle). No optimized runtime. Not production-safe.

### What We Chose: ONNX
**Why:** Framework agnosticism is critical for teams using multiple training frameworks. ONNX Runtime provides excellent performance with minimal configuration.

---

## Decision 2: Inference Pattern

### Option A: Synchronous (Request/Response)
**Pros:** Simple, predictable latency, easy to debug.
**Cons:** Low throughput. GPU underutilized. Each request has overhead.

### Option B: Asynchronous (Queue + Worker)
**Pros:** High throughput, decouples client from compute, handles backpressure.
**Cons:** Higher latency (queued wait time). Requires Redis/RabbitMQ.

### Option C: Streaming
**Pros:** Real-time pipelines (video frame by frame).
**Cons:** Complex client code. Not needed for tabular/ batch predictions.

### What We Chose: Synchronous for single, Async batch for bulk
**Why:** Most ML APIs are synchronous for single predictions (mobile app waiting for a response). Batch jobs are asynchronous to prevent blocking.

---

## Decision 3: Model Registry Storage

### Option A: In-Memory Map
**Pros:** Zero latency, no external dependency, trivial implementation.
**Cons:** Lost on restart. No persistence. Single-instance only.

### Option B: Redis / Database
**Pros:** Persistent, shared across instances, supports rich querying.
**Cons:** Adds latency (~1ms). Another service to maintain.

### Option C: Object Storage (S3) + Metadata DB
**Pros:** Cheap, infinite scale, versioned automatically.
**Cons:** Model loading from S3 is slow (seconds). Needs local caching.

### What We Chose: In-Memory Map with architecture for S3+DB
**Why:** For educational scope, in-memory is sufficient. Production systems use MLflow Model Registry or a custom S3+PostgreSQL setup.

---

## Decision 4: A/B Testing Strategy

### Option A: Client-Side Routing
**Pros:** Server is simple. Client decides which version to call.
**Cons:** Clients must be updated to change traffic split. Inconsistent across platforms.

### Option B: Server-Side Routing (Traffic Split)
**Pros:** Centralized control. Instant traffic shift. Consistent across all clients.
**Cons:** Server must maintain routing rules. Slightly more complex.

### What We Chose: Server-Side with Client Override
**Why:** Default routing is server-side (active version). Power users can specify a version explicitly for testing.
