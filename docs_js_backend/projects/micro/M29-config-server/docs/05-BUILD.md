# 05-BUILD: Config Server

## WHAT are we building?

A minimal config server with strict environment isolation. It stores configuration per application and environment, validates input, and prevents cross-environment contamination.

## WHY build it from scratch?

Understanding the namespace boundary (`app × env`) is critical. Many production incidents occur because a config server accidentally shared storage across environments. Building it teaches you to never trust a single key.

## HOW to build it step-by-step from an empty folder

### Step 0: Empty Folder

```bash
mkdir config-server && cd config-server
```

### Step 1: Initialize Project

```bash
npm init -y
npm install express typescript ts-node @types/express @types/node supertest @types/supertest jest @jest/globals ts-jest
```

### Step 2: TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### Step 3: Environment-Isolated Storage

```typescript
// src/config.ts
const store: Record<string, Record<string, Record<string, any>>> = {};

export function setConfig(app: string, env: string, config: any) {
  if (!store[app]) {
    store[app] = {};
  }
  store[app][env] = { ...store[app][env], ...config };
}

export function getConfig(app: string, env: string) {
  return store[app]?.[env] ?? {};
}

export function getStore() {
  return store;
}
```

**WHAT:** Stores config in a 3-level hierarchy: `app → env → key-values`.
**WHY:** Prevents dev writes from overwriting prod.
**HOW:** JavaScript object with `store[app][env]` path.

### Step 4: Validation

```typescript
// src/validator.ts
export function validateConfig(config: any): { valid: boolean; error?: string } {
  if (typeof config !== 'object' || config === null) {
    return { valid: false, error: 'Config must be an object' };
  }

  for (const [key, value] of Object.entries(config)) {
    if (typeof key !== 'string' || key.length === 0) {
      return { valid: false, error: 'Keys must be non-empty strings' };
    }
    if (value === null || value === undefined) {
      return { valid: false, error: `Value for ${key} cannot be null or undefined` };
    }
  }

  return { valid: true };
}
```

**WHAT:** Validates that config is a non-null object with valid keys and values.
**WHY:** Prevents garbage data from entering the store.
**HOW:** Iterates entries and checks types.

### WRONG vs RIGHT in Steps 3-4

| Without Fix | With Fix |
|-------------|----------|
| `store[app]` only | `store[app][env]` hierarchy |
| Dev overwrites prod | Environments are isolated |
| No validation | Rejects null values and non-objects |

### Step 5: Main Application

```typescript
// src/index.ts
import express, { Request, Response } from 'express';
import { setConfig, getConfig } from './config.js';
import { validateConfig } from './validator.js';

const app = express();
const PORT = process.env.CONFIG_PORT || 3000;

app.use(express.json());

app.post('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  const config = req.body;

  const validation = validateConfig(config);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  setConfig(appName, env, config);
  res.json({ status: 'ok', app: appName, env });
});

app.get('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  const config = getConfig(appName, env);
  res.json(config);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Config Server listening on port ${PORT}`);
  });
}

export { app };
```

### Step 6: Test

```bash
# Start server
npm run dev

# Set dev config
curl -X POST http://localhost:3000/config/myapp/dev \
  -H "Content-Type: application/json" \
  -d '{"dbHost":"localhost","debug":true}'

# Set prod config
curl -X POST http://localhost:3000/config/myapp/prod \
  -H "Content-Type: application/json" \
  -d '{"dbHost":"prod.example.com","debug":false}'

# Get dev config
curl http://localhost:3000/config/myapp/dev
# → {"dbHost":"localhost","debug":true}

# Get prod config
curl http://localhost:3000/config/myapp/prod
# → {"dbHost":"prod.example.com","debug":false}

# Verify isolation: dev did NOT overwrite prod
```

## ASCII Diagram: Build Flow

```
Empty Folder
    │
    ▼
npm init + install deps
    │
    ▼
 tsconfig.json
    │
    ▼
 src/config.ts      src/validator.ts   src/index.ts
    │                    │                    │
    └────────────────────┼────────────────────┘
                         ▼
                  npm run dev
                         │
                         ▼
              POST dev → POST prod → GET dev → GET prod
```
