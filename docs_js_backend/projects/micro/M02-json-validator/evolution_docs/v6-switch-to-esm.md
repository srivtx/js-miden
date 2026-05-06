# v6-switch-to-esm.md — "My imports are a mess"

## The Bug

You're using CommonJS:

```js
const express = require('express');
const { z } = require('zod');

module.exports = { app };
```

You try to conditionally import a validation library only when needed:

```js
if (process.env.ENABLE_CUSTOM_VALIDATION) {
  const custom = require('./custom-validation');
}
```

This works, but it's synchronous and blocks the event loop. You want to lazy-load it:

```js
const custom = await import('./custom-validation.js');
```

CommonJS `require` is synchronous. Dynamic `import()` works in CommonJS, but it's inconsistent. Some tools expect `require`. Others expect `import`. Your codebase is a mix of both.

## The 3am Page, Redux

You have a circular dependency:

```js
// validation.js
const { app } = require('./app');

// app.js
const { userSchema } = require('./validation');
```

`validation.js` requires `app.js`. `app.js` requires `validation.js`. CommonJS handles this by returning an incomplete object. `app` is `{}` when `validation.js` loads. Your code crashes with `app.get is not a function`.

You spend hours moving `require` calls around to break the cycle. ESM handles circular dependencies more predictably because imports are hoisted and resolved statically.

## Why ESM?

- **Static analysis** — bundlers, tree-shakers, and IDEs understand your imports
- **Top-level await** — lazy-load modules without blocking
- **Named exports** — explicit and refactorable
- **Circular dependency handling** — more predictable than CommonJS
- **Node.js default** — Node 20+ prefers ESM. CommonJS is legacy.

## The Migration

### 1. Add `"type": "module"` to `package.json`

```json
{
  "name": "m02-json-validator",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

### 2. Change `require` to `import`

```ts
// Before
const express = require('express');
const { z } = require('zod');

// After
import express from 'express';
import { z } from 'zod';
```

### 3. Change `module.exports` to `export`

```ts
// Before
module.exports = { app };
module.exports.userSchema = userSchema;

// After
export const app = express();
export const userSchema = z.object({ ... });
```

### 4. Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  }
}
```

### 5. Add `.js` to relative imports

```ts
// Before
import { userSchema } from './validation';

// After
import { userSchema } from './validation.js';
```

## What Changed

- `"type": "module"` in `package.json`
- `require` → `import`
- `module.exports` → `export`
- `tsconfig.json` uses `"module": "NodeNext"`
- Relative imports include `.js` extension
- Static imports prevent circular dependency surprises

## What We Still Need

We've built a typed, validated, tested, ESM application. Now we need to see the final structure and understand how all the pieces fit together.

For that, we need the production setup.
