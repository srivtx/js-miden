export interface Model {
  id: string;
  name: string;
  version: string;
  path: string;
  metadata: ModelMetadata;
  createdAt: number;
}

export interface ModelMetadata {
  inputShape: number[];
  outputShape: number[];
  framework: 'tensorflow' | 'pytorch' | 'onnx';
  description?: string;
}

export interface PredictionRequest {
  modelName: string;
  version?: string;
  input: number[] | number[][];
}

export interface PredictionResponse {
  modelId: string;
  version: string;
  output: number[] | number[][];
  latencyMs: number;
}

export interface BatchPredictionRequest {
  modelName: string;
  version?: string;
  inputs: (number[] | number[][])[];
}

export interface BatchPredictionResponse {
  modelId: string;
  version: string;
  outputs: (number[] | number[][])[];
  latencyMs: number;
  batchSize: number;
}

export interface ModelMetrics {
  totalRequests: number;
  totalErrors: number;
  averageLatencyMs: number;
  predictionsPerMinute: number;
}