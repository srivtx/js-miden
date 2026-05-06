# MD11 GraphQL Server — v6 Switch to ESM

## Overview
Migrate from CommonJS (`require`) to ESM (`import`). Update `tsconfig.json`, add `"type": "module"` to `package.json`, and adopt `.js` extensions in TypeScript imports. This unlocks top-level await and aligns with Apollo Server 4 defaults.

## Changes
- `package.json`: `"type": "module"`
- `tsconfig.json`: `"module": "ESNext"`, `"moduleResolution": "bundler"`
- All internal imports use `.js` extensions: `import { typeDefs } from './schema/typeDefs.js'`
- Replace `__dirname` with `import.meta.url` where needed.

## Code Snippet
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  }
}
```

```typescript
// src/server.ts (top-level await)
await server.start();
app.use('/graphql', expressMiddleware(server, { context }));
httpServer.listen(config.port);
```

## Rationale
- Apollo Server 4 and `graphql-ws` assume ESM.
- Top-level await simplifies server bootstrapping.
- Tree-shaking reduces bundle size for any future edge deployment.

## Trade-offs
- Jest/Node test runners may need `--experimental-vm-modules` unless using Vitest (which we are).
- Some older middleware still ships as CJS; `esModuleInterop` handles most cases.

## Next Step
Production hardening: depth limiting, complexity analysis, persisted queries, schema stitching, and subscriptions (v7).
