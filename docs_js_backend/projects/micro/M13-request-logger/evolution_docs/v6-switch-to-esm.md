# v6-switch-to-esm.md — Request Logger

## The Pain

CommonJS caused issues with modern logging libraries:

```javascript
// logger.js (CommonJS)
const pino = require('pino');
const logger = pino({ level: 'info' });
module.exports = { logger };
```

Pino v9+ is ESM-only. `require('pino')` throws:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module pino not supported
```

We were stuck on Pino v8, missing security fixes and performance improvements.

We also wanted to use `pino-pretty` for development:
```javascript
// CommonJS can't conditionally import ESM dev dependencies easily
if (process.env.NODE_ENV === 'development') {
  const pretty = require('pino-pretty');  // may be ESM-only too
}
```

## The Fix: Switch to ESM

```typescript
// src/logger.ts (ESM)
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

```typescript
// src/middleware/logger.ts (ESM)
import { logger } from '../logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });
  next();
}
```

Now:
- Pino v9+ works natively
- Conditional transports are clean
- Tree-shaking removes unused logger methods in bundled deployments

## But ESM Has Gotchas

1. **`pino.transport` is async:** Some Pino features require async initialization, which ESM handles gracefully with top-level await.
2. **Worker threads:** Pino's async destination uses worker threads. ESM worker threads need `--experimental-import-meta-resolve` in older Node versions.

## Why Not Use `createRequire`?

```typescript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pino = require('pino');  // works for CJS pino, fails for ESM-only pino
```

`createRequire` is a compatibility bridge, not a solution. It fails for ESM-only packages.

> **Lesson:** The logging ecosystem is moving to ESM. Staying on CJS means missing updates and carrying compatibility debt.
