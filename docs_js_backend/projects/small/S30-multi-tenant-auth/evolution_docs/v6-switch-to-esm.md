# v6-switch-to-esm

## Goal
Adopt ESM and use top-level `await` for DB initialization.

## Changes
1. `"type": "module"` in `package.json`.
2. All imports use `.js` extension.
3. Top-level `await initDb()` in `src/index.ts`.

## Code

```ts
// src/index.ts
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes.js';
import { initDb } from './db.js';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use('/', authRouter);

await initDb();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`S30 listening on ${PORT}`));

export { app };
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

## Decisions
- `helmet` and `express-rate-limit` are ESM-compatible in latest versions.
- Top-level `await` for `initDb()` ensures tables exist before accepting requests.

## Risks
- `bcryptjs` is pure JS and ESM-safe. Native `bcrypt` may need CJS interop.
