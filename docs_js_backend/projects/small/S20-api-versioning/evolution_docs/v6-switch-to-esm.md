# S20 API Versioning — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your API versioning project uses a mix:

```json
// package.json
"type": "module",
"test": "node --test tests/**/*.test.ts"
```

**Problems:**
1. Node.js test runner with TypeScript requires loaders or transpilation
2. `require()` might still exist in test setup files
3. No top-level await — can't load version configurations from an async source
4. File extensions are implicit — `import './routes'` might resolve to `.js` or `.ts` unpredictably

## The Fix: Full ESM Alignment

The project already has `"type": "module"` in `package.json`. The final step is aligning everything:

```json
// package.json
{
  "name": "s20-api-versioning",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "node --watch --loader ts-node/esm src/index.ts",
    "test": "node --test tests/**/*.test.ts"
  }
}
```

```ts
// routes.ts
import { Router, Request, Response } from 'express';

export interface UserV1 {
  id: string;
  name: string;
}

export interface UserV2 {
  id: string;
  firstName: string;
  lastName: string;
}

export const v1Router = Router();
export const v2Router = Router();

export function transformV2toV1(user: UserV2): UserV1 {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  };
}
```

```ts
// index.ts
import express, { Request, Response, NextFunction } from 'express';
import { v1Router, v2Router } from './routes.js';

const app = express();
app.use(express.json());

app.use('/v1', v1Router);
app.use('/v2', v2Router);

export { app };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API versioning service running on port ${PORT}`);
  });
}
```

**What full ESM gives you:**
- No `--loader` hacks in production
- `import.meta.url` for self-execution guards
- Named exports are first-class — `export { v1Router, v2Router }`
- File extensions are explicit — `./routes.js`

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `routes.ts` mixes v1 and v2 data with transformation logic. `index.ts` mixes URL routing with content negotiation. Time to clean up.

## What v7 Fixes

Final production setup. Clean `src/` directory, proper version separation, and deprecation handling.
