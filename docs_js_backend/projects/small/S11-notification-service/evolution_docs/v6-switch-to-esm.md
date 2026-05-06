# v6 — Switching to ESM

You're trying to import a modern notification utility library. It's ESM-only. Your CommonJS code chokes.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported
```

You try dynamic imports. It works but makes your route handlers async for no good reason. Your error handling gets messier.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// notifications.ts
import { Router } from 'express';
import db from './db.js';
import { broadcastUnreadCount } from './sse.js';

const router = Router();
// ...
export default router;
```

## Why ESM?

- **Modern libraries work** — no `require()` compatibility shims
- **Top-level await** — clean async initialization
- **Static analysis** — better for bundling and tree-shaking
- **Standard** — it's JavaScript's native module system

## Migration

- Add `"type": "module"`
- Use `.js` extensions in imports
- Use `node:` prefixes for built-ins

**Next:** Production setup.
