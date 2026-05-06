import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistryService } from '../src/services/ModelRegistryService.js';
import { PredictionService } from '../src/services/PredictionService.js';
import { BatchService } from '../src/services/BatchService.js';

describe('BatchService', () => {
  let batchService: BatchService;

  beforeEach(() => {
    const registry = new ModelRegistryService();
    const predictionService = new PredictionService(registry);
    batchService = new BatchService(predictionService);

    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });
  });

  it('should process batch predictions', async () => {
    const result = await batchService.predictBatch({
      modelName: 'iris',
      inputs: [
        [5.1, 3.5, 1.4, 0.2],
        [4.9, 3.0, 1.4, 0.2],
        [4.7, 3.2, 1.3, 0.2],
      ],
    });

    expect(result.batchSize).toBe(3);
    expect(result.outputs).toHaveLength(3);
  });

  it('should track batch status', async () => {
    const { batchId, status } = await batchService.submitBatch({
      modelName: 'iris',
      inputs: [[5.1, 3.5, 1.4, 0.2]],
    });

    expect(batchId).toBeDefined();
    expect(status).toBe('completed');

    const batchStatus = batchService.getBatchStatus(batchId);
    expect(batchStatus?.status).toBe('completed');
  });

  it('should count active batches', async () => {
    await batchService.submitBatch({
      modelName: 'iris',
      inputs: [[5.1, 3.5, 1.4, 0.2]],
    });

    expect(batchService.getActiveBatchCount()).toBe(0); // Completed immediately
  });
});