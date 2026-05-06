import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistryService } from '../src/services/ModelRegistryService.js';
import { PredictionService } from '../src/services/PredictionService.js';
import { MonitoringService } from '../src/services/MonitoringService.js';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let predictionService: PredictionService;

  beforeEach(() => {
    const registry = new ModelRegistryService();
    predictionService = new PredictionService(registry);
    monitoringService = new MonitoringService(predictionService, registry);

    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });
  });

  it('should return health status', () => {
    const health = monitoringService.getHealth();
    expect(health.status).toBe('healthy');
    expect(health.uptime).toBeGreaterThan(0);
  });

  it('should track model metrics', async () => {
    await predictionService.predict({
      modelName: 'iris',
      input: [5.1, 3.5, 1.4, 0.2],
    });

    const metrics = monitoringService.getModelMetrics('iris');
    expect(metrics).not.toBeNull();
    expect(metrics?.totalRequests).toBe(1);
  });

  it('should return all metrics', () => {
    const metrics = monitoringService.getAllMetrics();
    expect(metrics).toHaveProperty('iris');
  });
});