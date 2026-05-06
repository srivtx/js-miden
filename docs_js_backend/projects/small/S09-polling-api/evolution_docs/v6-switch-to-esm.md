# v6 — Switching to ESM

You're trying to use a modern date library in your polling API. It's ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module @date-fns not supported
```

You try dynamic import. It works but it's async and ugly. You try `await import()` in the middle of a route. It works but feels wrong.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// polls.ts
import { Router, Request, Response } from 'express';
import db from './db.js';

const router = Router();
// ...
export default router;
```

## Why ESM?

- **Modern libraries work out of the box** — no `require()` hacks
- **Static analysis** — bundlers can tree-shake unused code
- **Standardized** — it's the JavaScript module standard, not a Node-specific workaround

## Migration

- Add `"type": "module"`
- Use `.js` extensions in imports
- Use `node:` prefixes for built-ins

**Next:** Production setup.
