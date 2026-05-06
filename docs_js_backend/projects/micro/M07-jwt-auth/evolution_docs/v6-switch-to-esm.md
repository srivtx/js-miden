# v6-switch-to-esm.md — "My imports are a mess"

## The Bug

You're using CommonJS:

```js
const express = require('express');
const jwt = require('jsonwebtoken');

module.exports = router;
```

You want to use `jwt.verify` with async/await:

```js
const util = require('util');
const verifyAsync = util.promisify(jwt.verify);
```

This works, but it's a workaround. With ESM and modern Node.js, many libraries now return promises natively or provide promisified versions.

## The 3am Page, Redux

You want to dynamically load the JWT secret from a secrets manager:

```js
let SECRET;
(async () => {
  SECRET = await secretsManager.get('jwt-secret');
})();
```

But `module.exports = router` runs before the IIFE finishes. The router is exported immediately, but `SECRET` is still `undefined` when the first request arrives. The first few requests fail with "invalid secret" until the IIFE completes.

With ESM top-level await:

```ts
const SECRET = await secretsManager.get('jwt-secret');
export default router;
```

The module doesn't finish loading until the secret is fetched. No race condition. No undefined secrets.

## Why ESM?

- **Top-level await** — load secrets, config, and certificates at module scope
- **No promisify wrappers** — modern libraries provide native promises
- **Static analysis** — bundlers and security scanners understand imports
- **Named exports** — explicit API surface
- **Node.js default** — Node 20+ prefers ESM. CommonJS is legacy.

## The Migration

### 1. Add `"type": "module"` to `package.json`

```json
{
  "name": "m07-jwt-auth",
  "type": "module",
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc",
    "test": "vitest run"
  }
}
```

### 2. Change `require` to `import`

```ts
// Before
const express = require('express');
const jwt = require('jsonwebtoken');

// After
import express from 'express';
import jwt from 'jsonwebtoken';
```

### 3. Change `module.exports` to `export`

```ts
// Before
module.exports = router;

// After
export default router;
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
import authRouter from './routes/auth';

// After
import authRouter from './routes/auth.js';
```

## What Changed

- `"type": "module"` in `package.json`
- `require` → `import`
- `module.exports` → `export default`
- `tsconfig.json` uses `"module": "NodeNext"`
- Relative imports include `.js` extension
- Top-level await available for secret loading

## What We Still Need

We've built a typed, validated, tested, ESM application. Now we need to see the final structure and understand how all the pieces fit together.

For that, we need the production setup.
