# v6-switch-to-esm

## Goal
Move to ESM for top-level await, tree-shaking, and native module compatibility.

## Changes
1. `"type": "module"` in `package.json`.
2. All imports use `.js` extension.
3. `import.meta.url` for path resolution.
4. Use `file-type` v19 ESM build.

## Code

```json
// package.json
{
  "name": "s26-file-upload",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

```ts
// src/services/storage.ts
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

## Decisions
- `vitest` natively supports ESM — no config changes needed.
- `tsx` for dev handles TypeScript + ESM transparently.

## Risks
- `multer` is CJS but works with ESM import. Some S3 SDK methods need careful default import handling.
