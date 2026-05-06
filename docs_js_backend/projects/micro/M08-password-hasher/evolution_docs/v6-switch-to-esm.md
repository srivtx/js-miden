# v6-switch-to-esm.md — Password Hasher

## The Pain

We had a working CommonJS codebase:

```javascript
// routes.js (CommonJS)
const crypto = require('crypto');
const { hashSchema } = require('./validation');

module.exports = { hashRouter };
```

```javascript
// index.js (CommonJS)
const express = require('express');
const { hashRouter } = require('./routes');
```

Then we needed:
1. **Top-level await** for loading Argon2 configuration from a config file
2. **Named imports** from `node:crypto` to use `timingSafeEqual`
3. **Tree-shaking** to eliminate unused crypto algorithms from a bundle

CommonJS blocked all of these:

```javascript
// Impossible in CommonJS without an IIFE
const config = await loadConfig();  // SyntaxError: await is only valid in async function
```

```javascript
// Dynamic require works but is messy
const argon2 = require('argon2');
// Named imports from ESM packages fail
const { hash, verify } = require('argon2');  // may fail if argon2 is pure ESM
```

## The Fix: Switch to ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```typescript
// src/routes.ts (ESM)
import { Router } from 'express';
import crypto from 'crypto';
import { hashSchema } from './validation.js';  // .js extension required!

export const hashRouter = Router();
```

```typescript
// src/index.ts (ESM)
import express from 'express';
import { hashRouter } from './routes.js';

const app = express();
```

Now top-level await works:
```typescript
// src/config.ts
const config = await loadConfig();  // valid in ESM
export { config };
```

## But ESM Has Gotchas

1. **`.js` extensions required:** TypeScript files import other TypeScript files with `.js` extensions:
   ```typescript
   import { hashRouter } from './routes.js';  // routes.ts on disk
   ```
2. **No `__dirname`:** Must use `import.meta.url`:
   ```typescript
   const __dirname = fileURLToPath(new URL('.', import.meta.url));
   ```
3. **Some packages are CJS-only:** `require()` is gone. Must use `createRequire`:
   ```typescript
   import { createRequire } from 'module';
   const require = createRequire(import.meta.url);
   const legacy = require('legacy-cjs-package');
   ```

## Circular Dependencies

ESM detects circular dependencies at parse time and throws clearer errors. In CJS, circular requires often return `{}` (empty object) silently, causing `undefined` method errors later.

> **Lesson:** ESM enables modern JavaScript features (top-level await, tree-shaking, named imports). The migration pain is worth it for production code, but requires updating tooling (tsx, vitest, tsc).
