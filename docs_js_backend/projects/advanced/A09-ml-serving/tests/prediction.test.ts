import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistryService } from '../src/services/ModelRegistryService.js';
import { PredictionService } from '../src/services/PredictionService.js';

describe('PredictionService', () => {
  let registry: ModelRegistryService;
  let predictionService: PredictionService;

  beforeEach(() => {
    registry = new ModelRegistryService();
    predictionService = new PredictionService(registry);

    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });
  });

  it('should make a prediction', async () => {
    const result = await predictionService.predict({
      modelName: 'iris',
      input: [5.1, 3.5, 1.4, 0.2],
    });

    expect(result.version).toBe('1.0.0');
    expect(result.output).toHaveLength(3);
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('should validate input shape', async () => {
    await expect(
      predictionService.predict({
        modelName: 'iris',
        input: [1, 2, 3], // Wrong shape
      })
    ).rejects.toThrow('Invalid input shape');
  });

  it('should handle batch predictions', async () => {
    const outputs = await predictionService.predictBatch(
      [
        [5.1, 3.5, 1.4, 0.2],
        [4.9, 3.0, 1.4, 0.2],
      ],
      'iris'
    );

    expect(outputs).toHaveLength(2);
    expect(outputs[0]).toHaveLength(3);
  });

  it('should track prediction metrics', async () => {
    await predictionService.predict({
      modelName: 'iris',
      input: [5.1, 3.5, 1.4, 0.2],
    });

    const count = predictionService.getPredictionCount('iris-v1.0.0');
    expect(count).toBe(1);
  });

  it('should throw for non-existent model', async () => {
    await expect(
      predictionService.predict({
        modelName: 'nonexistent',
        input: [1, 2, 3, 4],
      })
    ).rejects.toThrow('Model not found');
  });
});