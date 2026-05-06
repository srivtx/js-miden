# v6: Switch to ESM — Retry Logic

## The Pain

In CJS, dynamic `require()` is allowed anywhere:

```typescript
if (someCondition) {
  const { RetryClient } = require('./retry-logic');
}
```

This defeats static analysis. Your bundler cannot tree-shake. Your IDE cannot find references. Then you add `"type": "module"` and `require` is undefined.

```
ReferenceError: require is not defined in ES module scope
```

## The Solution

Embrace ESM's static imports. Every dependency is declared at the top of the file.

## Before (CJS)

```typescript
// src/index.ts
import express from 'express';
import { RetryClient } from './retry-logic';

const client = new RetryClient({
  maxRetries: 3,
  baseDelayMs: 1000,
});
```

## After (ESM)

```json
// package.json
{
  "name": "m25-retry-logic",
  "type": "module",
  "main": "dist/index.js"
}
```

```typescript
// src/index.ts
import express from 'express';
import { RetryClient } from './retry-logic.js';

const client = new RetryClient({
  maxRetries: 3,
  baseDelayMs: 1000,
});
```

```javascript
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  testTimeout: 30000,
};
```

## Why ESM in 2025

Static imports enable:
- **Tree-shaking**: Unused exports are removed at build time
- **Fast startup**: No dynamic resolution at runtime
- **Type safety**: TypeScript knows every import at check time
- **Future compatibility**: `import.meta.url` for `__dirname` replacement

## The Bug It Catches

In CJS, this typo might resolve to the wrong file:

```typescript
import { RetryClient } from './retrylogic'; // missing hyphen
```

CJS tries `retrylogic.js`, `retrylogic.ts`, `retrylogic/index.js`, `retry-logic.js` via complex resolution rules. ESM fails fast with a clear `ERR_MODULE_NOT_FOUND`.
