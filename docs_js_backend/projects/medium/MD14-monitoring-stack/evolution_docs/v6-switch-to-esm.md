# MD14 Monitoring Stack — v6 Switch to ESM

## Overview
Convert from CommonJS to ESM. Update `tsconfig.json`, `package.json`, and all import paths. This aligns with modern Node.js and Vitest defaults.

## Changes
- `package.json`: `"type": "module"`
- `tsconfig.json`: `"module": "ESNext"`, `"moduleResolution": "bundler"`
- All relative imports use `.js` extensions.

## Code Snippet
```json
// package.json
{
  "name": "monitoring-stack",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest"
  }
}
```

## Rationale
- ESM enables tree-shaking and is the default for new packages.
- Vitest runs ESM tests without `--experimental-vm-modules`.

## Trade-offs
- Some CJS-only packages may need dynamic `import()` wrappers.

## Next Step
Production hardening: cardinality limits, retention policies, alert hysteresis, and Docker (v7).
