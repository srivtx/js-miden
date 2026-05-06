# v3: Add Validation — Config Manager

## The Pain

You POST:

```json
{ "key": "api.timeout", "value": "infinite" }
```

The config manager stores `"infinite"`. Your HTTP client later does:

```typescript
const timeout = config.get('api.timeout');
setTimeout(() => {}, timeout); // setTimeout("infinite") throws or hangs
```

Or worse:

```json
{ "key": "api.port", "value": 999999 }
```

`http.createServer().listen(999999)` throws `RangeError: port should be >= 0 and < 65536`.

The config manager accepted garbage. The application crashed. The config manager should have rejected it.

## The Solution

Add schema-based validation for every config key.

## Before (No Validation)

```typescript
// src/config-manager.ts
async set(key: string, value: any): Promise<void> {
  this.cache.set(key, value);
  await this.save();
}
```

## After (With Validation)

```typescript
// src/validation.ts
export interface ConfigSchema {
  key: string;
  type: 'string' | 'number' | 'boolean';
  min?: number;
  max?: number;
}

export function validateValue(key: string, value: any, schema: ConfigSchema[]): { valid: boolean; error?: string } {
  const rule = schema.find(s => s.key === key);
  if (!rule) return { valid: true }; // Unknown keys allowed

  if (typeof value !== rule.type) {
    return { valid: false, error: `${key} must be ${rule.type}, got ${typeof value}` };
  }

  if (rule.type === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return { valid: false, error: `${key} must be >= ${rule.min}` };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { valid: false, error: `${key} must be <= ${rule.max}` };
    }
  }

  return { valid: true };
}
```

```typescript
// src/config-manager.ts
import { validateValue, ConfigSchema } from './validation.js';

export class ConfigManager {
  private schema: ConfigSchema[] = [
    { key: 'api.timeout', type: 'number', min: 0, max: 300000 },
    { key: 'api.port', type: 'number', min: 1, max: 65535 },
    { key: 'db.ssl', type: 'boolean' },
  ];

  async set(key: string, value: any): Promise<void> {
    const validation = validateValue(key, value, this.schema);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    this.cache.set(key, value);
    await this.save();
  }
}
```

## The Bug It Catches

- `api.timeout: "infinite"` → `Error: api.timeout must be number, got string`
- `api.port: 999999` → `Error: api.port must be <= 65535`
- `api.port: -1` → `Error: api.port must be >= 1`
- `db.ssl: "true"` → `Error: db.ssl must be boolean, got string`

## Why Validation Matters

- **Crash prevention**: Invalid config is rejected at write time, not read time
- **Self-documenting**: The schema tells operators exactly what values are valid
- **Safety**: `min`/`max` bounds prevent typos like `timeout: 300000000` (10 years)
- **Consistency**: Every environment uses the same validation rules

Without validation, the config manager is a JSON pastebin. With validation, it is a typed system boundary.
