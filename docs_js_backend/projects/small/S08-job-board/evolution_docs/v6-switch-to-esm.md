# v6 — Switching to ESM

You're debugging an import error at 11 PM.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported
```

Half your dependencies ship ESM-only. Half your code uses `require`. Your `tsconfig.json` says `ESNext` but something somewhere is doing `require` and Node is angry.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// app.ts
import express from 'express';
import jobsRouter from './jobs.js';

const app = express();
app.use(express.json());
app.use('/jobs', jobsRouter);
```

## Why ESM?

- **No `require.cache` weirdness** — modules load predictably
- **Tree-shaking** — smaller bundles if you ever need them
- **Top-level await** — cleaner initialization code
- **Alignment with the ecosystem** — most modern packages are ESM-first

## Migration Notes

- Use `.js` extensions in TypeScript imports
- Replace `__dirname` with `fileURLToPath(import.meta.url)`
- Use `node:` prefixes for built-in modules

**Next:** Let's productionize.
