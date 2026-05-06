# Testing Guide

## Test Structure

```
tests/
├── model.test.ts        # Model registry (contains bug test)
├── prediction.test.ts   # Single prediction logic
├── batch.test.ts        # Batch processing
└── monitoring.test.ts   # Metrics collection
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Test Categories

### Model Registry Tests

```typescript
describe('ModelRegistryService', () => {
  it('BUG: New model overwrites old version', () => {
    registry.registerModel('iris', '1.0.0', ...);
    registry.registerModel('iris', '2.0.0', ...);
    const v1 = registry.getModel('iris', '1.0.0');
    expect(v1).toBeNull(); // Bug: v1 is lost forever!
  });
});
```

### Prediction Tests

- Input shape validation
- Model not found handling
- Latency tracking
- Output format verification

### Batch Tests

- Large batch processing
- Partial failure handling
- Status tracking

### Load Testing

Use `autocannon` for load testing:

```bash
npm install -g autocannon
autocannon -c 100 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -b '{"modelName":"iris-classifier","input":[5.1,3.5,1.4,0.2]}' \
  http://localhost:3000/api/predict
```

## References

[1] Vitest Documentation. https://vitest.dev/
[2] Load Testing ML APIs, AWS Whitepaper, 2022.