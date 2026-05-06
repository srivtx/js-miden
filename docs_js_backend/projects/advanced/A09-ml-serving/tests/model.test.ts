import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistryService } from '../src/services/ModelRegistryService.js';

describe('ModelRegistryService', () => {
  let registry: ModelRegistryService;

  beforeEach(() => {
    registry = new ModelRegistryService();
  });

  it('should register a model', () => {
    const model = registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });
    expect(model.name).toBe('iris');
    expect(model.version).toBe('1.0.0');
  });

  it('BUG: New model overwrites old version - cannot retrieve previous version', () => {
    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });

    registry.registerModel('iris', '2.0.0', '/models/iris-v2', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });

    const model = registry.getModel('iris', '1.0.0');
    expect(model).toBeNull(); // BUG: v1 is lost forever!

    const latest = registry.getModel('iris');
    expect(latest?.version).toBe('2.0.0');
  });

  it('BUG: Rollback fails because old version is overwritten', () => {
    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });

    registry.registerModel('iris', '2.0.0', '/models/iris-v2', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });

    const success = registry.rollbackModel('iris', '1.0.0');
    expect(success).toBe(false); // BUG: Cannot rollback, v1 is gone
  });

  it('should return active version', () => {
    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });
    expect(registry.getActiveVersion('iris')).toBe('1.0.0');
  });

  it('should list all model names', () => {
    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });
    registry.registerModel('mnist', '1.0.0', '/models/mnist-v1', {
      inputShape: [784],
      outputShape: [10],
      framework: 'pytorch',
    });
    expect(registry.listModels()).toHaveLength(2);
  });
});

describe('ModelRegistryService - A/B Testing', () => {
  let registry: ModelRegistryService;

  beforeEach(() => {
    registry = new ModelRegistryService();
  });

  it('should support A/B testing between model versions', () => {
    // This test documents the expected A/B behavior that is broken by the bug
    registry.registerModel('iris', '1.0.0', '/models/iris-v1', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });

    registry.registerModel('iris', '2.0.0', '/models/iris-v2', {
      inputShape: [4],
      outputShape: [3],
      framework: 'tensorflow',
    });

    // With the bug, we can only get v2, not v1
    const v1 = registry.getModel('iris', '1.0.0');
    const v2 = registry.getModel('iris', '2.0.0');

    expect(v1).toBeNull(); // BUG
    expect(v2).not.toBeNull();
  });
});