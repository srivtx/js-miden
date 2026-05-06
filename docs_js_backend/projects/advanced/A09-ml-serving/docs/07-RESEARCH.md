# Research Notes

## Standards & Specifications

1. **ONNX (Open Neural Network Exchange)**
   https://onnx.ai/
   Linux Foundation AI, 2019.
   Key finding: ONNX defines an open standard for ML model interoperability. PyTorch, TensorFlow, scikit-learn, and MXNet all support export to ONNX.

2. **ONNX Runtime Performance Tuning**
   https://onnxruntime.ai/docs/performance/
   Microsoft, 2023.
   Key finding: ONNX Runtime provides 1.5-2x speedup over native frameworks via graph optimizations (constant folding, operator fusion) and execution providers (CUDA, TensorRT, DirectML).

3. **TensorFlow Serving Architecture**
   https://www.tensorflow.org/tfx/serving/architecture
   Google, 2023.
   Key finding: TensorFlow Serving uses a "model version policy" (latest, specific, or all) and loads models asynchronously to avoid blocking. Inspired the design of this project's registry.

4. **OpenAPI 3.0 Specification**
   https://swagger.io/specification/
   OpenAPI Initiative, 2021.
   Key finding: Standard for REST API documentation. This project's endpoints follow OpenAPI conventions.

## Books

5. **Huyen, C.** *Designing Machine Learning Systems*. O'Reilly Media, 2022.
   Chapter 7: "Model Deployment and Prediction Serving." Covers batch vs online inference, model versioning, and monitoring.

6. **Lakshmanan, V., Robinson, S., & Munn, M.** *Machine Learning Design Patterns*. O'Reilly Media, 2020.
   Pattern: "Model Versioning." Describes shadow mode, canary, and blue/green deployment strategies.

## Academic Papers

7. **Sculley, D., et al.** "The ML Test Score: A Rubric for ML Production Readiness." Google, 2017.
   https://research.google/pubs/pub46555/
   Key finding: Production ML systems require 28 distinct tests covering data, model, infrastructure, and monitoring. Most teams test < 5.

8. **Breck, E., et al.** "What's Your ML Test Score? A Rubric for ML Production Systems." *IEEE Big Data*, 2017.
   Quantifies the gap between research prototypes and production systems.

## Industry Sources

9. **"ML Model Management: A Comprehensive Guide," Google Cloud, 2022.**
   https://cloud.google.com/architecture/ml-model-management

10. **"Monitoring Machine Learning Models in Production," Google, 2020.**
    Key finding: Track prediction distributions, not just latency. A model can have perfect latency while making nonsensical predictions.

## Tools

11. **ONNX Runtime**
    https://onnxruntime.ai/
    Cross-platform, high-performance scoring engine for ONNX models.

12. **TensorFlow Serving**
    https://www.tensorflow.org/tfx/serving
    Flexible, high-performance serving system for ML models, designed for production environments.

13. **MLflow Model Registry**
    https://mlflow.org/docs/latest/model-registry.html
    Centralized model store with versioning, stage transitions, and annotations.

14. **BentoML**
    https://www.bentoml.com/
    Framework for building production-ready ML model serving endpoints.

15. **NVIDIA Triton Inference Server**
    https://developer.nvidia.com/triton-inference-server
    Supports multiple frameworks, dynamic batching, and GPU sharing.

## Benchmarks

| Framework | Latency (CPU) | Latency (GPU) | Throughput | Ease of Use |
|-----------|--------------|---------------|------------|-------------|
| ONNX Runtime | 12ms | 3ms | High | Easy |
| TensorFlow Serving | 18ms | 4ms | Very High | Medium |
| PyTorch (native) | 25ms | 5ms | Medium | Easy |
| Custom (Python) | 80ms | N/A | Low | Hard |

## Industry Adoption

- **Google**: TensorFlow Serving handles 10M+ predictions/second across Search, Ads, and YouTube. Every model version is canaried for 24 hours.
- **Netflix**: Uses a custom "Model Server" with A/B testing built-in. Their recommendation system tests 50+ model variants simultaneously.
- **Uber**: Michelangelo platform (now open-sourced as Orbit) requires shadow mode validation before any model receives live traffic.
- **Airbnb**: "Bighead" platform uses ONNX Runtime for inference. Their "model cards" document expected input distributions — deviations trigger alerts.
