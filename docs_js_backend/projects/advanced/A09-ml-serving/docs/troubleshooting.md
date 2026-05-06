# Troubleshooting

## Known Bugs

### Bug 1: No Model Versioning (CRITICAL)

**Symptom**: After deploying v2.0.0, all requests to v1.0.0 return 404. Rollback fails.

**Root Cause**: `ModelRegistryService` uses model name as the Map key, so registering a new version overwrites the old one.

**Location**: `src/services/ModelRegistryService.ts`

**Buggy Code**:
```typescript
registerModel(name, version, path, metadata) {
  const model = { id: `${name}-v${version}`, name, version, path, metadata, ... };
  this.models.set(name, model); // BUG: Overwrites previous version!
  this.activeVersions.set(name, version);
}

getModel(name, version) {
  const model = this.models.get(name);
  if (version && model?.version !== version) return null; // Version gone!
  return model;
}
```

**Impact**:
- Cannot rollback to previous versions
- A/B testing between versions is impossible
- Blue/green deployments broken

**Fix**: Use composite key `${name}:${version}`:
```typescript
registerModel(name, version, path, metadata) {
  const model = { ... };
  this.models.set(`${name}:${version}`, model); // Fixed!
  this.modelsByName.set(name, [...(this.modelsByName.get(name) || []), model]);
  this.activeVersions.set(name, version);
}

getModel(name, version) {
  const v = version || this.activeVersions.get(name);
  return this.models.get(`${name}:${v}`) || null;
}
```

**Test**: `tests/model.test.ts` - "BUG: New model overwrites old version"

## Common Issues

### Model Not Found
- Verify model was registered: `GET /api/models`
- Check version string matches exactly ("1.0.0" vs "1.0")
- Ensure model file exists at specified path

### Input Shape Mismatch
```json
{ "error": "Invalid input shape: expected [4], got [3]" }
```
- Check `metadata.inputShape` in model registration
- Verify client sends correct array dimensions

### High Latency
- Enable batching for throughput
- Use GPU for large models
- Check if model is loading synchronously (another bug pattern)

## Debug Logging

```bash
DEBUG=ml:* npm run dev
```

## References

[1] ML Model Versioning Best Practices, MLflow Documentation.
[2] "Why Model Versioning Matters," Google AI Blog, 2021.