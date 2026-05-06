import { Model, ModelMetadata } from '../types/index.js';
import { logError } from '../utils/logger.js';

/**
 * Model Registry Service
 * BUG: New model overwrites old model with same name. No versioning support.
 * Cannot rollback to previous versions.
 */
export class ModelRegistryService {
  private models: Map<string, Model> = new Map(); // key is modelName (BUG: should be modelName:version)
  private activeVersions: Map<string, string> = new Map(); // modelName -> version
  private metrics: Map<string, { loads: number; errors: number }> = new Map();

  registerModel(name: string, version: string, path: string, metadata: ModelMetadata): Model {
    // BUG: Overwrites existing model with same name, losing previous version
    const model: Model = {
      id: `${name}-v${version}`,
      name,
      version,
      path,
      metadata,
      createdAt: Date.now(),
    };

    this.models.set(name, model); // BUG: key should be `${name}:${version}`
    this.activeVersions.set(name, version);
    this.metrics.set(model.id, { loads: 0, errors: 0 });

    return model;
  }

  getModel(name: string, version?: string): Model | null {
    // BUG: Cannot retrieve specific version, always returns latest
    const model = this.models.get(name);
    if (!model) return null;

    // If version specified, we can't actually return it because we overwrote it
    // This is the bug manifestation
    if (version && model.version !== version) {
      return null; // Previous version is gone!
    }

    return model;
  }

  getActiveVersion(name: string): string | null {
    return this.activeVersions.get(name) || null;
  }

  getAllVersions(name: string): Model[] {
    // BUG: Can only return one version since we overwrote previous ones
    const model = this.models.get(name);
    return model ? [model] : [];
  }

  // This rollback method cannot work because old versions are deleted
  rollbackModel(name: string, version: string): boolean {
    // BUG: Rollback impossible - old version was overwritten
    const model = this.models.get(name);
    if (!model || model.version !== version) {
      return false; // Version lost forever
    }
    this.activeVersions.set(name, version);
    return true;
  }

  listModels(): string[] {
    return Array.from(this.models.keys());
  }

  getModelMetrics(modelId: string) {
    return this.metrics.get(modelId);
  }
}