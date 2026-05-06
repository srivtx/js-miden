import fs from 'fs/promises';
import path from 'path';

export interface ConfigEntry {
  key: string;
  value: any;
}

export class ConfigManager {
  private configPath: string;
  private cache: Map<string, any> = new Map();

  constructor(configPath: string = './config.json') {
    this.configPath = path.resolve(configPath);
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cache = new Map(Object.entries(parsed));
    } catch {
      this.cache = new Map();
    }
  }

  async save(): Promise<void> {
    const obj: Record<string, any> = {};
    for (const [key, value] of this.cache) {
      obj[key] = value;
    }

    // BUG: No atomic update - direct write can corrupt config on crash
    const json = JSON.stringify(obj, null, 2);
    await fs.writeFile(this.configPath, json, 'utf-8');
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  getAll(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [key, value] of this.cache) {
      obj[key] = value;
    }
    return obj;
  }

  async set(key: string, value: any): Promise<void> {
    // BUG: No validation - accepts any JSON, crashes when type is wrong
    this.cache.set(key, value);
    await this.save();
  }

  async setMultiple(entries: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      this.cache.set(key, value);
    }
    await this.save();
  }
}
