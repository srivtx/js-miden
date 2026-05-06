# v6: Switch to ESM — Feature Flag Service

## The Pain

You write `import { FeatureFlagService } from './feature-flag'` in TypeScript. `tsc` compiles it to `const { FeatureFlagService } = require('./feature-flag')` in CJS. Then you switch to `"type": "module"` and Node crashes with:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module './feature-flag' imported from ./dist/index.js
```

Node ESM requires explicit file extensions. Every import breaks.

## The Solution

1. Add `"type": "module"` to `package.json`
2. Change `tsconfig.json` to `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
3. Rewrite every relative import to include `.js`:
   - `from './feature-flag'` → `from './feature-flag.js'`
4. Update Jest to `ts-jest/presets/default-esm`

## Before (CJS)

```json
// package.json
{
  "main": "dist/index.js"
  // no type field
}
```

```typescript
// src/index.ts (CJS style)
import express from 'express';
import { FeatureFlagService } from './feature-flag';
```

## After (ESM)

```json
// package.json
{
  "type": "module",
  "main": "dist/index.js"
}
```

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
  }
}
```

```typescript
// src/index.ts (ESM)
import express from 'express';
import { FeatureFlagService } from './feature-flag.js';
```

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
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  testTimeout: 10000,
};
```

## Why ESM in 2025

- **Top-level await**: `await manager.load()` without async wrapper
- **Static analysis**: Tree-shaking removes dead code
- **Browser/Node compatibility**: Same module system everywhere
- **Future-proof**: CJS is maintenance mode; ESM is where new features land

## The Bug It Catches

With CJS, `require('./feature-flag')` silently resolves to `feature-flag.js`, `feature-flag.ts`, or even `feature-flag/index.js`. ESM forces you to be explicit. That explicitness prevents "it works on my machine" path resolution bugs.
