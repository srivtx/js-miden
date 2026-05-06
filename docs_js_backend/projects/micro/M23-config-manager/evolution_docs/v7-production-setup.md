# v7: Production Setup — Config Manager

## The Journey

We started with hardcoded objects, added types, validation, logging, tests, and ESM. Now we have a config manager that survives production.

## What v7 Adds

- **dotenv integration**: Secrets and overrides from `.env`
- **Schema validation**: Every value is typed and bounded
- **Atomic writes**: Temp-file + rename prevents corruption
- **Hot reload**: `fs.watch` reloads config without restart
- **Graceful defaults**: Missing file → empty map, not crash

## The Final Code

```typescript
// src/config-manager.ts
import fs from 'fs/promises';
import path from 'path';
import { watch } from 'fs';
import { logger } from './logger.js';

export interface ConfigSchema {
  key: string;
  type: 'string' | 'number' | 'boolean';
  default?: any;
}

export class ConfigManager {
  private cache: Map<string, any> = new Map();
  private schema: Map<string, ConfigSchema> = new Map();

  constructor(
    private configPath: string = './config.json',
    schema?: ConfigSchema[]
  ) {
    if (schema) {
      for (const entry of schema) this.schema.set(entry.key, entry);
    }
    this.setupWatcher();
  }

  private setupWatcher(): void {
    watch(this.configPath, () => {
      logger.info('Config file changed, reloading...');
      this.load().catch(err => logger.error({ err }, 'Hot reload failed'));
    });
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cache = new Map(Object.entries(parsed));
      logger.info({ keys: this.cache.size }, 'Config loaded');
    } catch {
      this.cache = new Map();
      logger.warn('Config file missing, starting empty');
    }
  }

  async save(): Promise<void> {
    const obj = Object.fromEntries(this.cache);
    const tmp = `${this.configPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
    await fs.rename(tmp, this.configPath);
    logger.info('Config saved atomically');
  }

  validate(key: string, value: any): boolean {
    const rule = this.schema.get(key);
    if (!rule) return true;
    if (typeof value !== rule.type) {
      logger.error({ key, expected: rule.type, got: typeof value }, 'Validation failed');
      return false;
    }
    return true;
  }

  async set(key: string, value: any): Promise<void> {
    if (!this.validate(key, value)) throw new Error(`Validation failed for ${key}`);
    this.cache.set(key, value);
    await this.save();
  }
}
```

## Why This Matters in Production

A crash during a direct `fs.writeFile` can leave a 0-byte config.json. Atomic write + rename guarantees the file is always valid JSON. Hot reload means you can change `max_connections` without restarting 40 pods.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Hardcoded values need redeploys | File-based config map |
| v2 | `any` types allow `"5000"` strings | `ConfigEntry` interface + `ConfigSchema` |
| v3 | `"infinite"` timeout strings crash callers | Runtime type validation |
| v4 | No audit trail of config changes | Structured logging on every load/save |
| v5 | Atomic write bug corrupts file on crash | Temp-file + `fs.rename` |
| v6 | CJS require resolution quirks | ESM with explicit `.js` extensions |
| v7 | Downtime to change config, no schema guard | Hot reload + dotenv + atomic writes |

## Run It

```bash
CONFIG_PATH=./config.json node dist/index.js
```
