# A06 Evolution: v6 — Switch to ESM

## State of the System

The project is now a pure ES module package. All `require()` calls are replaced with `import`, and all file imports include the `.js` extension. TypeScript compiles to ESM, and `tsx` runs the code without CommonJS interop.

## What Changed

- **`"type": "module"` in package.json.** Node.js treats all `.js` and `.ts` files as ES modules.
- **`.js` extensions on all relative imports.** `import { storage } from './storage.js'` replaces `import { storage } from './storage'`.
- **`tsx` for development.** `npm run dev` uses `tsx src/index.ts`, which transpiles TypeScript to ESM on the fly.
- **`tsc` for build.** `npm run build` emits `.js` files with ES module syntax.
- **Dynamic imports for optional ML model loaders.** The AI check module can dynamically import `@tensorflow/tfjs` or `onnxruntime-node` only when configured, reducing startup time.

## What Still Breaks

- **Race condition is not fixed by ESM.** Module boundaries are cleaner, but concurrent writes to `MemoryStorage` still overwrite each other.
- **No top-level await for model loading.** `ai-check.ts` uses synchronous keyword matching. A real ML model would load asynchronously, but the module is imported eagerly.
- **No import maps.** Third-party packages are resolved from `node_modules`. There is no pnpm workspace or import map for monorepo sharing.
- **Test runner compatibility.** Vitest handles ESM natively, but some `__dirname` patterns require `fileURLToPath(import.meta.url)`.

## Code Snapshot (package.json)

```json
{
  "name": "a06-content-moderation",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^5.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "supertest": "^7.0.0"
  }
}
```

## Architectural Notes

This is the "ESM + ML pipeline" stage. ES modules enable tree-shaking, dynamic imports, and explicit dependency graphs. The AI check module is now a standalone file that can be replaced with a real ML integration without touching the rest of the pipeline. However, the system still runs in a single process with in-memory storage.

## Migration Path to v7

1. Add Docker and docker-compose for production deployment.
2. Replace `MemoryStorage` with PostgreSQL and Redis for the queue.
3. Add Prometheus metrics and health checks.
4. Implement optimistic locking with version numbers to fix the race condition.
