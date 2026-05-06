# Critic Review

## Technical Review
A senior MLOps engineer would say:

- **"No GPU support. CPU inference is fine for Iris classification, but production models need CUDA."**
  The project uses mock inference. Adding ONNX Runtime with `ort.InferenceSession.create(path, { executionProviders: ['cuda'] })` is necessary for real workloads.

- **"No model caching. Every request re-fetches from the registry."**
  The `PredictionService` should cache loaded `InferenceSession` objects. Loading a model from disk on every request adds 50-500ms.

- **"No feature store. Clients send raw features. This is dangerous."**
  In production, feature engineering (scaling, encoding) should happen server-side or in a feature store (Feast, Tecton). Sending raw features leads to training/serving skew.

- **"No drift detection. The monitoring service tracks latency but not prediction quality."**
  Track prediction distributions (mean, std, percentiles). Alert if they deviate > 20% from the training baseline. This is the #1 cause of silent model degradation.

- **"No request authentication. Anyone can call /api/predict."**
  API keys or OAuth2 are required. Rate limiting is required. A malicious client could send 1M predictions and bankrupt your GPU cloud bill.

## Security Review

- **Model Poisoning**: If the model registry accepts arbitrary file paths, an attacker could register a malicious model file that exploits a vulnerability in ONNX Runtime.
- **Model Extraction**: Unlimited predictions allow model stealing. An attacker sends systematically varied inputs and reconstructs the model via query synthesis.
- **Input Injection**: No sanitization of input arrays. A malformed input could trigger a buffer overflow in the inference runtime (though ONNX Runtime is generally safe).

## Educational Review

- **What's missing**: A chapter on "training/serving skew" — when the preprocessing pipeline in training differs from serving. This is the #1 cause of model performance drops in production.
- **What's confusing**: The difference between "model registry" (metadata) and "model storage" (weights file) is blurred. Students may think the registry stores the actual weights.
- **What's excellent**: The model overwrite bug is a realistic and expensive mistake. The fix teaches composite-key patterns and the value of immutable version history.
- **Suggested addition**: A demonstration of ONNX Runtime actual inference (not mock). Show how to export a scikit-learn model to ONNX and serve it.
- **Suggested addition**: A "model card" template documenting intended use, training data, expected inputs, and known limitations.

## Fixes Applied in This Revision
- Added composite key (`${name}:${version}`) to `ModelRegistryService`.
- Added `MAX_BATCH_SIZE` validation.
- Added lazy/async model loading pattern.
- Added latency tracking with rolling window.

## Grade: B+
Excellent educational project for ML serving fundamentals. The model versioning bug is particularly strong. Missing production concerns (GPU, feature store, drift detection, auth) but appropriate for scope.
