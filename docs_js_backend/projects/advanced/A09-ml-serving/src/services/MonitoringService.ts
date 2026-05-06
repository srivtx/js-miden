import { ModelMetrics } from '../types/index.js';
import { PredictionService } from './PredictionService.js';
import { ModelRegistryService } from './ModelRegistryService.js';

export class MonitoringService {
  private startTime = Date.now();

  constructor(
    private predictionService: PredictionService,
    private registry: ModelRegistryService
  ) {}

  getHealth(): { status: string; uptime: number } {
    return {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
    };
  }

  getModelMetrics(modelName: string): ModelMetrics | null {
    const model = this.registry.getModel(modelName);
    if (!model) return null;

    const modelId = `${modelName}-v${model.version}`;
    const predictionCount = this.predictionService.getPredictionCount(modelId);

    return {
      totalRequests: predictionCount,
      totalErrors: 0, // Simplified
      averageLatencyMs: this.predictionService.getAverageLatency(modelId),
      predictionsPerMinute: this.calculatePPM(predictionCount),
    };
  }

  private calculatePPM(totalRequests: number): number {
    const uptimeMinutes = (Date.now() - this.startTime) / 60000;
    return uptimeMinutes > 0 ? totalRequests / uptimeMinutes : 0;
  }

  getAllMetrics(): Record<string, ModelMetrics> {
    const metrics: Record<string, ModelMetrics> = {};
    for (const modelName of this.registry.listModels()) {
      const modelMetrics = this.getModelMetrics(modelName);
      if (modelMetrics) {
        metrics[modelName] = modelMetrics;
      }
    }
    return metrics;
  }
}