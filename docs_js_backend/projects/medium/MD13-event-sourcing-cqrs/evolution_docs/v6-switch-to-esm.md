# MD13 Event Sourcing + CQRS — v6 Switch to ESM

## Overview
Convert the codebase from CommonJS to ESM. This aligns with Prisma v5 defaults and enables top-level await in the server bootstrap.

## Changes
- `package.json`: `"type": "module"`
- `tsconfig.json`: `"module": "ESNext"`, `"moduleResolution": "bundler"`
- All imports use `.js` extensions.

## Code Snippet
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

## Rationale
- ESM is the standard for new Node.js libraries.
- Top-level await simplifies `await prisma.$connect()` before starting the HTTP server.

## Trade-offs
- Jest needs `--experimental-vm-modules`; Vitest handles ESM natively.

## Next Step
Full production setup: async projections, snapshots, read/write separation, and CQRS enforcement (v7).
