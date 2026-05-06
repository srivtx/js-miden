# BUILD: Config Manager

## Step-by-Step from Empty Folder

### Step 0: Create Project Directory

```bash
mkdir M23-config-manager
cd M23-config-manager
npm init -y
```

### Step 1: Install Dependencies

```bash
npm install express@^5.0.0
npm install -D typescript@^5.4.0 @types/node@^20.0.0 @types/express@^5.0.0 \
  jest@^29.7.0 @types/jest@^29.5.0 ts-jest@^29.1.0 supertest@^7.0.0 \
  @types/supertest@^6.0.0
```

### Step 2: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 3: Configure Jest

```javascript
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testTimeout: 10000,
};
```

### Step 4: Create the Config Manager Core

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
```

**Key design choices explained:**
- `Map<string, any>`: O(1) lookups, preserves key insertion order
- `path.resolve()`: Converts relative paths to absolute, avoiding cwd confusion
- `try/catch` in `load()`: Missing file is not an error; start with empty config
- `JSON.stringify(obj, null, 2)`: Pretty-printed JSON for human readability

### Step 5: Create the Express Server

```typescript
// src/index.ts
import express from 'express';
import { ConfigManager } from './config-manager.js';

const app = express();
app.use(express.json());

const manager = new ConfigManager('./config.json');
await manager.load();

app.get('/config/:key', (req, res) => {
  const { key } = req.params;
  const value = manager.get(key);

  if (value === undefined) {
    res.status(404).json({ error: 'Config key not found' });
    return;
  }

  res.json({ key, value });
});

app.get('/config', (req, res) => {
  res.json(manager.getAll());
});

app.post('/config', async (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    res.status(400).json({ error: 'Key is required' });
    return;
  }

  await manager.set(key, value);
  res.json({ key, value });
});

app.post('/config/bulk', async (req, res) => {
  await manager.setMultiple(req.body);
  res.json({ updated: Object.keys(req.body) });
});

export { app, manager };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Config manager service running on port ${PORT}`);
  });
}
```

**Route design explained:**
- `GET /config/:key`: Retrieve single value
- `GET /config`: Dump all config (useful for debugging)
- `POST /config`: Set single key-value pair
- `POST /config/bulk`: Set multiple values at once

### Step 6: Write Tests

```typescript
// tests/config-manager.test.ts
import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import { app, manager } from '../src/index.js';

const TEST_CONFIG_PATH = path.resolve('./test-config.json');

describe('Config Manager', () => {
  beforeEach(async () => {
    try {
      await fs.unlink(TEST_CONFIG_PATH);
    } catch {
      // ignore
    }
    (manager as any).cache = new Map();
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_CONFIG_PATH);
    } catch {
      // ignore
    }
  });

  it('should store and retrieve config values', async () => {
    await request(app)
      .post('/config')
      .send({ key: 'api.timeout', value: 5000 });

    const res = await request(app).get('/config/api.timeout');
    expect(res.status).toBe(200);
    expect(res.body.value).toBe(5000);
  });

  it('should return 404 for missing keys', async () => {
    const res = await request(app).get('/config/missing');
    expect(res.status).toBe(404);
  });

  it('should validate numeric config values', async () => {
    await request(app)
      .post('/config')
      .send({ key: 'api.port', value: 'not-a-number' });

    const res = await request(app).get('/config/api.port');
    // BUG: No validation means string is accepted
    expect(typeof res.body.value).not.toBe('string');
  });

  it('should handle bulk updates', async () => {
    await request(app)
      .post('/config/bulk')
      .send({ 'db.host': 'localhost', 'db.port': 5432 });

    const res = await request(app).get('/config');
    expect(res.body['db.host']).toBe('localhost');
    expect(res.body['db.port']).toBe(5432);
  });

  it('should reject invalid JSON structure', async () => {
    const res = await request(app)
      .post('/config')
      .send({ key: 'bad', value: undefined });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should persist across reloads', async () => {
    await request(app)
      .post('/config')
      .send({ key: 'feature.x', value: true });

    const data = await fs.readFile('./config.json', 'utf-8');
    const parsed = JSON.parse(data);
    expect(parsed['feature.x']).toBe(true);
  });
});
```

### Step 7: Run and Verify

```bash
npm run build
npm test
npm start
```

**Expected test results:** `should validate numeric config values` will fail due to missing validation. `should reject invalid JSON structure` may also behave unexpectedly.
