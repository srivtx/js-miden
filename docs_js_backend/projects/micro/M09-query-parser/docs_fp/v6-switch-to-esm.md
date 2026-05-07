# v6-switch-to-esm.md — Query Param Parser

## The Pain

CommonJS served us well, but we hit limitations:

```javascript
// validation.js (CommonJS)
const { z } = require('zod');
module.exports = { searchSchema };
```

1. **Zod is ESM-first:** Newer versions export only ESM. `require('zod')` breaks.
2. **We needed `URLSearchParams` from `node:url`:** Named imports are cleaner in ESM.
3. **Tree-shaking:** We only use `z.string()` and `z.number()` from Zod. CommonJS bundles the entire library.

## The Fix: Switch to ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  }
}
```

```typescript
// src/validation.ts (ESM)
import { z } from 'zod';

export const searchSchema = z.object({
  query: z.string().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

```typescript
// src/routes.ts (ESM)
import { Router } from 'express';
import { searchSchema } from './validation.js';

export const searchRouter = Router();
```

Now named imports work natively:
```typescript
import { URLSearchParams } from 'node:url';
const params = new URLSearchParams(req.query as Record<string, string>);
```

## But ESM Has Gotchas

1. **Dynamic imports are async:**
   ```typescript
   const { escapeHtml } = await import('./utils.js');
   ```
2. **No `require.main === module`:**
   ```typescript
   if (import.meta.url.endsWith(process.argv[1] ?? '')) {
     app.listen(PORT);
   }
   ```

## Why Not Stay on CJS?

The Node.js ecosystem is moving to ESM. Major libraries (Zod, Pino v9+, Vitest) are ESM-only or ESM-preferred. Sticking with CJS means:
- Missing security updates for ESM-only packages
- Larger bundles (no tree-shaking)
- Can't use top-level await for config loading

> **Lesson:** ESM is the future of Node.js. The migration cost is paid once; the CJS compatibility tax is paid forever.
