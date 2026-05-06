# v6-switch-to-esm.md — UUID Generator

## The Pain

CommonJS worked for basic UUIDs, but we wanted to support multiple formats:

```javascript
// uuid.js (CommonJS)
const { randomUUID } = require('crypto');

function generateUUID() {
  return randomUUID();
}
module.exports = { generateUUID };
```

Then we wanted to add UUID v7 and ULID support:

```javascript
// uuid.js (CommonJS)
const { randomUUID } = require('crypto');
const { v7 } = require('uuid');           // may be ESM-only
const { ulid } = require('ulidx');        // ESM-only

module.exports = { generateUUID, generateV7, generateULID };
```

`uuid` v10+ and `ulidx` are ESM-only. `require()` throws `ERR_REQUIRE_ESM`.

We also wanted top-level await for crypto initialization:

```javascript
// Impossible in CommonJS
await crypto.webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('seed'));
```

## The Fix: Switch to ESM

```typescript
// src/uuid.ts (ESM)
import { randomUUID } from 'node:crypto';
import { v7 } from 'uuid';
import { ulid } from 'ulidx';

export type UUIDFormat = 'v4' | 'v7' | 'ulid';

export function generateUUID(format: UUIDFormat = 'v4'): string {
  switch (format) {
    case 'v4': return randomUUID();
    case 'v7': return v7();
    case 'ulid': return ulid();
    default: throw new Error(`Unknown format: ${format}`);
  }
}
```

```typescript
// src/app.ts (ESM)
import express from 'express';
import { generateUUID } from './uuid.js';

export const app = express();

app.post('/generate', (req, res) => {
  const format = req.query.format as UUIDFormat || 'v4';
  const uuid = generateUUID(format);
  res.json({ uuid, format });
});
```

Now:
- Named imports from `uuid` and `ulidx` work natively
- Tree-shaking removes unused formats in bundled deployments
- Top-level await is available for crypto seeding

## But ESM Has Gotchas

1. **`uuid` v7 requires Node 20+:** ESM doesn't change runtime requirements.
2. **`import.meta.url` for paths:** No `__dirname` in ESM.
   ```typescript
   import { fileURLToPath } from 'node:url';
   const __dirname = fileURLToPath(new URL('.', import.meta.url));
   ```

## Why Multiple UUID Formats?

- **v4:** Pure random, no ordering. Good for security tokens.
- **v7:** Time-ordered, random suffix. Good for database primary keys (avoids index fragmentation).
- **ULID:** Lexicographically sortable, URL-safe. Good for distributed systems.

> **Lesson:** ESM enables using modern UUID libraries that are ESM-only. The module system shouldn't dictate your cryptographic choices.
