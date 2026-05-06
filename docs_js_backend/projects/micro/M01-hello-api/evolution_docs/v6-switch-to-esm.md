# v6-switch-to-esm.md — "My imports are a mess"

## The Bug

You're using CommonJS:

```js
const express = require('express');
const { createLogger } = require('pino');

module.exports = { createApp };
```

You try to use top-level await to load config:

```js
const config = await loadConfig();
```

Node throws:

```
SyntaxError: await is only valid in async functions and the top level bodies of modules
```

CommonJS doesn't support top-level await. You wrap everything in an async IIFE:

```js
(async () => {
  const config = await loadConfig();
  module.exports = { createApp: () => { ... } };
})();
```

Now `require('./app')` returns `{}` because the IIFE hasn't finished yet. Your app crashes with `createApp is not a function`.

## The 3am Page, Redux

You need the `__dirname` of the current file:

```js
const path = require('path');
const configPath = path.join(__dirname, 'config.json');
```

This works in CommonJS. But when you switch to a `.mjs` file, `__dirname` doesn't exist. You get:

```
ReferenceError: __dirname is not defined in ES module scope
```

You Google the hack:

```js
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

This is ugly. It's a workaround for a module system that was designed in 2009 and hasn't aged well.

## Why ESM?

- **Top-level await** — load config, connect to databases, all at module scope
- **Static analysis** — bundlers and tree-shakers can understand your imports
- **Named exports** — `export { createApp }` is explicit, not `module.exports = { ... }`
- **Native browser compatibility** — same syntax in Node and browser
- **Node.js default** — Node 20+ treats ESM as the standard. CommonJS is legacy.

## The Migration

### 1. Add `"type": "module"` to `package.json`

```json
{
  "name": "m01-hello-api",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

`"type": "module"` tells Node: "Every `.js` file in this package is ESM."

### 2. Change `require` to `import`

```ts
// Before (CommonJS)
const express = require('express');
const { createLogger } = require('pino');

// After (ESM)
import express from 'express';
import { createLogger } from 'pino';
```

### 3. Change `module.exports` to `export`

```ts
// Before
module.exports = { createApp };

// After
export function createApp() { ... }
```

### 4. Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

`"module": "NodeNext"` tells TypeScript to emit ESM with `.js` extensions in imports.

### 5. Add `.js` to relative imports

```ts
// Before
import { createApp } from './app';

// After
import { createApp } from './app.js';
```

This feels weird. The file is `app.ts`. But ESM requires the import to match the runtime filename, which is `app.js` after compilation. TypeScript with `"moduleResolution": "NodeNext"` enforces this.

## What Changed

- `"type": "module"` in `package.json`
- `require` → `import`
- `module.exports` → `export`
- `tsconfig.json` uses `"module": "NodeNext"`
- Relative imports include `.js` extension
- Top-level await now works natively

## What We Still Need

We've evolved from a 7-line `console.log` server to a structured, typed, validated, logged, tested, ESM application. But we need to see the whole picture. We need to understand the final file structure and why each piece is there.

For that, we need the production setup.
