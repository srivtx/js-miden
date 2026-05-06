# v6-switch-to-esm

## Goal
Enable top-level `await`, tree-shaking, and align with the Node.js LTS default.

## Changes
1. `"type": "module"` in `package.json`.
2. All imports use `.js` extension (TypeScript still compiles to `.js`).
3. Replace `__dirname` with `import.meta.url` patterns.
4. Switch ID generation from sequential counter to `crypto.randomUUID()`.

## Code

```ts
// src/service.ts
import { randomUUID } from 'crypto';

function generateCartId(): string {
  return randomUUID();
}
```

```json
// package.json (excerpt)
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "node --test tests/**/*.test.ts"
  }
}
```

```json
// tsconfig.json (excerpt)
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "dist"
  }
}
```

## Decisions
- `NodeNext` module resolution is required for ESM + TypeScript to resolve `.js` imports correctly.
- `tsx` for dev avoids pre-build step; `tsc` for production ensures type erasure.

## Risks
- Some older packages still lack ESM exports. All deps here (Express 5, ioredis, uuid) support it.
