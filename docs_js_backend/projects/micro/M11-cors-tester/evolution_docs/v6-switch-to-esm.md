# v6-switch-to-esm.md — CORS Tester

## The Pain

CommonJS worked, but we needed dynamic origin loading:

```javascript
// config.js (CommonJS)
const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
module.exports = { origins };
```

```javascript
// cors.js (CommonJS)
const { origins } = require('./config');

const privateCors = cors({
  origin: (origin, callback) => {
    if (origins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed'));
  },
});
```

Then we wanted to load origins from a remote config service at startup:

```javascript
// IMPOSSIBLE in CommonJS top-level
const origins = await fetchAllowedOrigins();  // SyntaxError
```

We had to wrap everything in an IIFE:
```javascript
(async () => {
  const origins = await fetchAllowedOrigins();
  module.exports = { origins };  // Too late! Already exported {}
})();
```

The exported `origins` was `undefined` because `module.exports` was already evaluated.

## The Fix: Switch to ESM

```typescript
// src/config.ts (ESM)
export const origins = await fetchAllowedOrigins();  // top-level await!
```

```typescript
// src/cors.ts (ESM)
import { origins } from './config.js';

export const privateCors = cors({
  origin: (origin, callback) => {
    if (!origin || origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

Top-level await means:
- The module doesn't finish loading until `fetchAllowedOrigins()` resolves
- Downstream modules (`cors.ts`, `app.ts`) wait automatically
- No IIFE wrappers, no callback hell

## But ESM Has Gotchas

1. **Top-level await blocks the module graph:** If `fetchAllowedOrigins()` hangs, the entire app hangs at startup.
2. **Testing:** Vitest handles ESM top-level await natively. Jest requires `transform` config.

## Why Not Dynamic `require()`?

```javascript
const config = await import('./config.js');  // works in both CJS and ESM
```

Dynamic `import()` works in CJS, but:
- It's async, so all consuming code must be async
- TypeScript types are harder to infer
- It doesn't solve the circular dependency problem

> **Lesson:** Top-level await is the killer feature of ESM. It eliminates IIFE boilerplate and makes async initialization readable.
