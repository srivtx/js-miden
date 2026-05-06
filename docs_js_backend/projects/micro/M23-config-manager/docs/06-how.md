# HOW: Config Manager

## Implementation Steps

### Step 1: Define Schema

```typescript
interface ConfigSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

const schemas: Record<string, ConfigSchema> = {
  'api.port': { type: 'number', min: 1, max: 65535 },
  'api.timeout': { type: 'number', min: 100 },
  'features.darkMode': { type: 'boolean' },
};
```

### Step 2: Validate on Write

```typescript
validate(key: string, value: any): void {
  const schema = schemas[key];
  if (!schema) return; // Unknown keys allowed or rejected based on policy

  if (typeof value !== schema.type) {
    throw new Error(
      `Expected ${schema.type} for ${key}, got ${typeof value}`
    );
  }

  if (schema.type === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      throw new Error(`${key} must be >= ${schema.min}`);
    }
    if (schema.max !== undefined && value > schema.max) {
      throw new Error(`${key} must be <= ${schema.max}`);
    }
  }
}
```

### Step 3: Atomic File Write

```typescript
async save(): Promise<void> {
  const obj = Object.fromEntries(this.cache);
  const tmpPath = `${this.configPath}.tmp`;

  // Write to temp file
  await fs.writeFile(tmpPath, JSON.stringify(obj, null, 2));

  // Atomic rename
  await fs.rename(tmpPath, this.configPath);
}
```

### Step 4: Hot Reload

```typescript
import { watch } from 'fs';

watch(this.configPath, () => {
  console.log('Config changed, reloading...');
  this.load().catch(console.error);
});
```

### Step 5: Type-Safe Accessors

```typescript
getNumber(key: string): number {
  const value = this.get(key);
  if (typeof value !== 'number') {
    throw new Error(`Config ${key} is not a number`);
  }
  return value;
}

getString(key: string): string {
  const value = this.get(key);
  if (typeof value !== 'string') {
    throw new Error(`Config ${key} is not a string`);
  }
  return value;
}
```

## Best Practices

- Validate at write time, not read time
- Use atomic file operations
- Support schema evolution
- Version your config files
- Log all config changes
- Never store secrets in plaintext JSON
