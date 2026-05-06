import { BatchPredictionRequest, BatchPredictionResponse } from '../types/index.js';
import { PredictionService } from './PredictionService.js';
import { logError, logInfo } from '../utils/logger.js';

export class BatchService {
  private activeBatches: Map<string, { status: string; progress: number }> = new Map();

  constructor(private predictionService: PredictionService) {}

  async submitBatch(request: BatchPredictionRequest): Promise<{ batchId: string; status: string }> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.activeBatches.set(batchId, { status: 'processing', progress: 0 });

    try {
      logInfo('Starting batch prediction', { batchId, size: request.inputs.length });

      const outputs = await this.predictionService.predictBatch(
        request.inputs,
        request.modelName,
        request.version
      );

      this.activeBatches.set(batchId, { status: 'completed', progress: 100 });

      return {
        batchId,
        status: 'completed',
      };
    } catch (error) {
      this.activeBatches.set(batchId, { status: 'failed', progress: 0 });
      logError('Batch prediction failed', error as Error, { batchId });
      throw error;
    }
  }

  async predictBatch(request: BatchPredictionRequest): Promise<BatchPredictionResponse> {
    const startTime = Date.now();

    const outputs = await this.predictionService.predictBatch(
      request.inputs,
      request.modelName,
      request.version
    );

    const latencyMs = Date.now() - startTime;
    const model = (this.predictionService as any).registry.getModel(request.modelName, request.version);

    return {
      modelId: `${request.modelName}-v${model?.version || 'unknown'}`,
      version: model?.version || 'unknown',
      outputs,
      latencyMs,
      batchSize: request.inputs.length,
    };
  }

  getBatchStatus(batchId: string): { status: string; progress: number } | null {
    return this.activeBatches.get(batchId) || null;
  }

  getActiveBatchCount(): number {
    let count = 0;
    for (const batch of this.activeBatches.values()) {
      if (batch.status === 'processing') count++;
    }
    return count;
  }
}