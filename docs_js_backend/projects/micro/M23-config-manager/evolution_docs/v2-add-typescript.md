# v2: Add TypeScript — Config Manager

## The Pain

You write the config manager in JavaScript:

```javascript
// src/config-manager.js
class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.cache = new Map();
  }

  async set(key, value) {
    this.cache.set(key, value);
    await this.save();
  }

  get(key) {
    return this.cache.get(key);
  }
}
```

Later, you use it:

```javascript
const manager = new ConfigManager();
await manager.load(); // TypeError: manager.load is not a function
```

You forgot to define `load()`. JavaScript didn't tell you. It happily created an object without the method and crashed at runtime.

Or:

```javascript
manager.set('timeout', '5000');
const timeout = manager.get('timeout');
setTimeout(() => {}, timeout); // setTimeout("5000") is valid but wrong
```

## The Solution

Add TypeScript. Define the class with explicit types.

## After (With TypeScript)

```typescript
// src/config-manager.ts
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
    const json = JSON.stringify(obj, null, 2);
    await fs.writeFile(this.configPath, json, 'utf-8');
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, value);
    await this.save();
  }
}
```

## The Bug TypeScript Catches

- `new ConfigManager()` → `OK` (default parameter works)
- `manager.load()` → `OK` (method is defined)
- `manager.set(123, 'value')` → `Argument of type 'number' is not assignable to parameter of type 'string'`
- `manager.save()` → `OK` (method exists with correct return type)

## Why TypeScript Matters

- **Missing methods**: `load()` must be defined or the class won't compile
- **Type safety**: `get()` returns `any` (intentional flexibility), but keys are always strings
- **Async clarity**: `save(): Promise<void>` forces `await` at call sites
- **IDE support**: Autocomplete shows `load`, `save`, `get`, `set` — no guesswork

Without TypeScript, a missing method crashes at runtime. With TypeScript, the class won't compile until it's complete.
