import { PredictionRequest, PredictionResponse, Model } from '../types/index.js';
import { ModelRegistryService } from './ModelRegistryService.js';
import { logError, logInfo } from '../utils/logger.js';

/**
 * Mock ML model inference for demonstration.
 * In production, this would load actual TensorFlow/PyTorch models.
 */
export class PredictionService {
  private predictions: Map<string, number> = new Map();
  private latencies: Map<string, number[]> = new Map();

  constructor(private registry: ModelRegistryService) {}

  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    const model = this.registry.getModel(request.modelName, request.version);

    if (!model) {
      throw new Error(`Model not found: ${request.modelName}@${request.version || 'latest'}`);
    }

    // Validate input shape
    this.validateInput(request.input, model);

    // Simulate inference latency
    await this.simulateLatency();

    // Mock prediction output
    const output = this.computeOutput(request.input, model);
    const latencyMs = Date.now() - startTime;

    const modelId = `${request.modelName}-v${model.version}`;
    this.trackPrediction(modelId, latencyMs);

    return {
      modelId,
      version: model.version,
      output,
      latencyMs,
    };
  }

  async predictBatch(inputs: (number[] | number[][])[], modelName: string, version?: string): Promise<number[][]> {
    const model = this.registry.getModel(modelName, version);
    if (!model) {
      throw new Error(`Model not found: ${modelName}@${version || 'latest'}`);
    }

    const outputs: number[][] = [];
    for (const input of inputs) {
      this.validateInput(input, model);
      outputs.push(this.computeOutput(input, model) as number[]);
    }
    return outputs;
  }

  private validateInput(input: number[] | number[][], model: Model): void {
    const expectedShape = model.metadata.inputShape;
    if (Array.isArray(input[0])) {
      // Batch input
      const batchInput = input as number[][];
      if (batchInput[0].length !== expectedShape[1]) {
        throw new Error(`Invalid input shape: expected [*, ${expectedShape[1]}], got [*, ${batchInput[0].length}]`);
      }
    } else {
      // Single input
      const singleInput = input as number[];
      if (singleInput.length !== expectedShape[0]) {
        throw new Error(`Invalid input shape: expected [${expectedShape[0]}], got [${singleInput.length}]`);
      }
    }
  }

  private computeOutput(input: number[] | number[][], model: Model): number[] | number[][] {
    const outputSize = model.metadata.outputShape[0];
    if (Array.isArray(input[0])) {
      return (input as number[][]).map(arr =>
        Array.from({ length: outputSize }, () => Math.random())
      );
    }
    return Array.from({ length: outputSize }, () => Math.random());
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
  }

  private trackPrediction(modelId: string, latencyMs: number): void {
    const count = this.predictions.get(modelId) || 0;
    this.predictions.set(modelId, count + 1);

    const latencies = this.latencies.get(modelId) || [];
    latencies.push(latencyMs);
    if (latencies.length > 1000) latencies.shift();
    this.latencies.set(modelId, latencies);
  }

  getPredictionCount(modelId: string): number {
    return this.predictions.get(modelId) || 0;
  }

  getAverageLatency(modelId: string): number {
    const latencies = this.latencies.get(modelId) || [];
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }
}