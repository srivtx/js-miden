# v6 — Switch to ESM

Your SaaS has tests, but the codebase still uses CommonJS `require()`. You're fighting module inconsistencies in tests. Tree shaking doesn't work. Bundle sizes are bloated. Top-level `await` is impossible.

## Pain #1: Dynamic Import Chaos in Tests

```typescript
// tests/unit/task.service.test.ts (CommonJS)
import { TaskService } from '../../src/task/services/task.js';
// Wait, this is .js extension but the file is .ts
// Jest needs special mapping. ts-jest config is complex.
// Mocks don't work consistently.
```

In CommonJS, `jest.mock()` behaves differently than in ESM. Spies on module imports are unreliable. You spend more time fighting the test runner than writing tests.

## Pain #2: No Tree Shaking

```javascript
// src/utils/helpers.js (CommonJS)
module.exports = {
  formatDate,
  parseQuery,
  validateEmail,
  deepClone,
  generateSlug,
  // ... 50 more utilities
};
```

A controller imports one helper:
```javascript
const { formatDate } = require('./helpers');
```

The bundler includes all 50 utilities in the production bundle. Unused code bloats the Docker image by 200KB.

## Pain #3: Top-Level Await is Impossible

```javascript
// CommonJS — can't do this
const config = await loadConfig(); // SyntaxError
module.exports = { config };
```

You have to wrap everything in async IIFEs:
```javascript
(async () => {
  const config = await loadConfig();
  module.exports = { config };
})();
```

This breaks synchronous `require()` callers. The config is undefined when they need it.

## The Fix: ESM Migration

### package.json

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/gateway/index.ts",
    "build": "tsc",
    "test": "vitest",
    "start": "node dist/gateway/index.js"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  }
}
```

### Source Files

```typescript
// src/task/services/task.ts (ESM)
import { Task } from '../models/task.js';
import { logger } from '../../utils/logger.js';
import type { ITask } from '../models/task.js';

export class TaskService {
  private log = logger.child({ component: 'TaskService' });

  async createProject(data: CreateProjectDTO, orgId: string) {
    this.log.info({ orgId }, 'Creating project');
    // ...
  }
}
```

```typescript
// src/gateway/index.ts (ESM with top-level await)
import express from 'express';
import { connectDatabase } from './database.js';
import { loadConfig } from './config.js';

const config = await loadConfig(); // Top-level await!
const app = express();

await connectDatabase(config.databaseUrl);

app.listen(config.port, () => {
  logger.info(`Gateway listening on ${config.port}`);
});
```

### Test Files

```typescript
// tests/unit/task.service.test.ts (ESM)
import { describe, it, expect, vi } from 'vitest';
import { TaskService } from '../../src/task/services/task.js';
import { Task } from '../../src/task/models/task.js';

vi.mock('../../src/task/models/task.js', () => ({
  Task: {
    create: vi.fn(),
    findOne: vi.fn(),
  }
}));

describe('TaskService', () => {
  it('should create a task', async () => {
    vi.mocked(Task.create).mockResolvedValue({ _id: '1', title: 'Test' } as any);
    const result = await taskService.createTask({ title: 'Test' }, 'org_1');
    expect(result.title).toBe('Test');
  });
});
```

## What Changed

| Before (CommonJS) | After (ESM) |
|-------------------|-------------|
| `require()` + `module.exports` | `import` + `export` |
| `__dirname` hack | `import.meta.url` |
| No top-level await | Native top-level await |
| No tree shaking | Dead code elimination |
| Jest config complexity | Vitest works out of the box |
| `.js` extension confusion | Consistent `.js` imports (TypeScript handles it) |

## Migration Strategy

```bash
# 1. Update package.json
npm pkg set type=module

# 2. Update tsconfig.json
# module: NodeNext, moduleResolution: NodeNext

# 3. Rename imports
# require('./foo') → import { foo } from './foo.js'
# module.exports = { bar } → export { bar }

# 4. Fix __dirname
# const __dirname = path.dirname(fileURLToPath(import.meta.url));

# 5. Update test runner
# jest → vitest (ESM-native)
```

## ESM as Modern Foundation

ESM is the standard. Node.js has supported it natively since v12. By 2025, CommonJS is legacy. ESM gives you:
- **Static analysis** — bundlers can optimize
- **Native async** — top-level await simplifies initialization
- **Standard compliance** — same module system in browser and Node
- **Better tooling** — Vitest, Rollup, esbuild work best with ESM

## Next Pain

The app works in development. But in production, there's no health check, no graceful shutdown, no environment-based config. A deploy kills active requests. You need production setup.
