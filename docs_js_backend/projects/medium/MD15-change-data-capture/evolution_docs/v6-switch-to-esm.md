# MD15 Change Data Capture — v6 Switch to ESM

## Overview
Convert the CDC pipeline from CommonJS to ESM. Update `tsconfig.json`, `package.json`, and all imports. This aligns with the modern Node.js ecosystem and Vitest's native ESM support.

## Changes
- `package.json`: `"type": "module"`
- `tsconfig.json`: `"module": "ESNext"`, `"moduleResolution": "bundler"`
- All imports use `.js` extensions.

## Code Snippet
```json
// package.json
{
  "name": "change-data-capture",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest"
  }
}
```

## Rationale
- ESM is the default for new Node.js packages (pg, zod, vitest).
- Top-level await simplifies `await initDb()` before starting the HTTP server.

## Trade-offs
- `__dirname` is unavailable; use `fileURLToPath(import.meta.url)` if needed.

## Next Step
Production setup: strict ordering, idempotent consumers, persistent offsets, and offset validation (v7).
