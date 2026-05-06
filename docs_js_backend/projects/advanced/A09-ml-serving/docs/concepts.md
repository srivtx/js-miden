# Core Concepts

## Model Serving Patterns

### Synchronous vs Asynchronous Inference

| Pattern | Latency | Throughput | Use Case |
|---------|---------|-----------|----------|
| Synchronous | Low | Medium | Real-time predictions |
| Asynchronous | Higher | High | Batch processing |
| Streaming | Variable | Very High | Real-time ML pipelines |

## Model Versioning

Semantic versioning for ML models [1]:
- **MAJOR**: Breaking changes (input/output format changes)
- **MINOR**: Backward-compatible improvements
- **PATCH**: Bug fixes, retraining with same data

### Versioning Strategies

| Strategy | Pros | Cons |
|----------|------|------|
| Shadow Mode | Zero risk | Double compute cost |
| Canary | Gradual rollout | Complex routing |
| Blue/Green | Instant rollback | Double infrastructure |

## A/B Testing for ML Models

1. **Randomized Assignment**: Route X% of traffic to variant B
2. **Metrics**: Compare accuracy, latency, business metrics
3. **Statistical Significance**: Use chi-square or t-tests
4. **Duration**: Run until reaching significance or max duration

## Inference Optimization

| Technique | Speedup | Complexity |
|-----------|---------|-----------|
| Quantization | 2-4x | Low |
| Pruning | 1.5-3x | Medium |
| Batching | 10-100x | Low |
| ONNX Runtime | 1.5-2x | Low |
| TensorRT | 5-10x | High |

## Batch Inference

Processing multiple inputs together:
- **Throughput**: Much higher than single predictions
- **Latency**: Slightly higher per-request, much lower per-item
- **GPU Utilization**: Better parallelism

## Monitoring ML Systems

Key metrics to track [2]:
- **Prediction latency** (p50, p95, p99)
- **Throughput** (predictions/second)
- **Error rate** (input validation, inference failures)
- **Model drift** (input distribution changes)
- **Data quality** (missing values, outliers)

## References

[1] "Semantic Versioning for ML Models," MLflow Documentation.
[2] "Monitoring Machine Learning Models in Production," Google, 2020.
[3] "The ML Test Score: A Rubric for ML Production Readiness," Google, 2017.
[4] "Designing Machine Learning Systems," Chip Huyen, O'Reilly, 2022.