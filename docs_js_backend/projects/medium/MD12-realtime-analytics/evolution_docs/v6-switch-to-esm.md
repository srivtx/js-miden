# MD12 Realtime Analytics — v6 Switch to ESM

## Overview
Convert the entire analytics service from CommonJS to ESM. This enables top-level await in the server bootstrap and aligns with Vitest's native ESM support.

## Changes
- `package.json`: `"type": "module"`
- `tsconfig.json`: `"module": "ESNext"`, `"moduleResolution": "bundler"`
- All relative imports gain `.js` extensions.

## Code Snippet
```json
// package.json
{
  "name": "realtime-analytics",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest"
  }
}
```

## Rationale
- ESM is the default for modern Node.js libraries (Redis v4, Prisma v5).
- Top-level await simplifies `await prisma.$connect()` in `src/server.ts`.

## Trade-offs
- `__dirname` is no longer available; use `fileURLToPath(import.meta.url)` if needed.

## Next Step
Production setup: Redis aggregation, atomic counters, sliding windows, TTL cleanup, and backpressure (v7).
