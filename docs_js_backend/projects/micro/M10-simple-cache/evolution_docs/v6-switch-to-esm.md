# v6-switch-to-esm.md — Simple Cache

## The Pain

CommonJS caused a subtle bug with cache initialization:

```javascript
// cache.js (CommonJS)
const cache = new SimpleCache(60);
module.exports = { cache, SimpleCache };
```

```javascript
// routes.js (CommonJS)
const { cache } = require('./cache');
```

```javascript
// app.js (CommonJS)
const { cache } = require('./cache');
const { router } = require('./routes');
```

Everything worked until we added a **circular dependency**:

```javascript
// metrics.js (CommonJS)
const { cache } = require('./cache');  // cache is exported

module.exports = { reportMetrics };
```

```javascript
// cache.js (CommonJS) — updated
const { reportMetrics } = require('./metrics');  // circular!

class SimpleCache {
  get(key) {
    reportMetrics('get');  // reportMetrics is undefined!
  }
}
```

In CommonJS, circular requires return **partially initialized exports**. `reportMetrics` is `undefined` when `cache.js` tries to use it. The code crashes at runtime with:
```
TypeError: reportMetrics is not a function
```

## The Fix: Switch to ESM

ESM handles circular dependencies more predictably:

```typescript
// src/cache.ts (ESM)
import { reportMetrics } from './metrics.js';  // circular, but ESM resolves it

export class SimpleCache<T = unknown> {
  get(key: string): T | undefined {
    reportMetrics('get');  // works because ESM bindings are live
    // ...
  }
}

export const cache = new SimpleCache(60);
```

```typescript
// src/metrics.ts (ESM)
import { cache } from './cache.js';

export function reportMetrics(op: string) {
  logger.info({ size: cache.size(), op });
}
```

ESM uses **live bindings** — when `metrics.js` eventually finishes initializing, `reportMetrics` becomes available to `cache.js` even if `cache.js` imported it early.

## But ESM Has Gotchas

1. **Top-level code runs in order:** If `cache.ts` top-level code depends on `metrics.ts` top-level code, initialization order matters.
2. **`import` is hoisted:** All imports run before any module code, but execution order follows the dependency graph.

## Why This Matters for Caches

Caches often have circular dependencies with metrics, logging, and config. ESM's live bindings prevent the `undefined` function crashes common in CJS circular requires.

> **Lesson:** Circular dependencies are common in real apps. ESM's live bindings prevent CJS's partially-initialized export bugs.
