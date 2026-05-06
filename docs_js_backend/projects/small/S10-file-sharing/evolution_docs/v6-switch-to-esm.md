# v6 — Switching to ESM

You're trying to use the `uuid` package in your file sharing API. You get:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module uuid not supported
```

You try `const { v4 } = require('uuid')`. It fails. You try `import { v4 } from 'uuid'`. TypeScript is happy but Node complains at runtime because your `package.json` doesn't have `"type": "module"`.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// storage.ts
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
```

## Why ESM?

- **No import hell** — modern packages just work
- **Static analysis** — bundlers can optimize
- **Future-proof** — Node is investing in ESM, not CommonJS

## Migration

- Add `"type": "module"` to `package.json`
- Use `.js` extensions in all imports
- Use `node:` prefixes for built-ins

**Next:** Production setup.
