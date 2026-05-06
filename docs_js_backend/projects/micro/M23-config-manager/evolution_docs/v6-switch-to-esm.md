# v6: Switch to ESM — Config Manager

## The Pain

CJS module resolution is implicit and magic. You write:

```typescript
import { ConfigManager } from './config-manager';
```

TypeScript compiles this to CJS, Node resolves it through a maze of `index.js` and `.js`/`.ts` lookups. Then you try to use top-level await:

```typescript
const manager = new ConfigManager();
await manager.load(); // SyntaxError in CJS
```

## The Solution

Switch the entire project to ESM.

## Before (CJS)

```json
// package.json
{
  "name": "m23-config-manager",
  "main": "dist/index.js"
}
```

```typescript
// src/index.ts
import express from 'express';
import { ConfigManager } from './config-manager';

const manager = new ConfigManager('./config.json');
// await manager.load(); // ERROR: await is only valid in async function
```

## After (ESM)

```json
// package.json
{
  "name": "m23-config-manager",
  "type": "module",
  "main": "dist/index.js"
}
```

```typescript
// src/index.ts
import express from 'express';
import { ConfigManager } from './config-manager.js';

const manager = new ConfigManager('./config.json');
await manager.load(); // Works! Top-level await is native in ESM
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
};
```

## Why ESM in 2025

Top-level await is not a convenience — it is a necessity for config loading. Without it, you need an async IIFE wrapper:

```typescript
(async () => {
  await manager.load();
  app.listen(PORT);
})();
```

That wrapper complicates testing and export structure. ESM removes the wrapper entirely.
