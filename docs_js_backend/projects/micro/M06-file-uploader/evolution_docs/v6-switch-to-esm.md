# v6-switch-to-esm.md — "My imports are a mess"

## The Bug

You're using CommonJS:

```js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

module.exports = app;
```

You need `__dirname` to resolve the uploads directory:

```js
const uploadsDir = path.join(__dirname, 'uploads');
```

This works in CommonJS. But in ESM, `__dirname` doesn't exist. You get:

```
ReferenceError: __dirname is not defined in ES module scope
```

You have to write:

```ts
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
```

This is the standard ESM replacement. It's a bit more verbose, but it's explicit about where the path comes from.

## The 3am Page, Redux

You want to stream a file using async generators:

```js
const stream = require('stream');
const pipeline = util.promisify(stream.pipeline);
```

With ESM, Node.js built-ins are imported directly:

```ts
import { pipeline } from 'stream/promises';
```

No `util.promisify` needed. ESM gets the promisified version natively. This is cleaner and less error-prone.

## Why ESM?

- **`import.meta.url`** — the ESM replacement for `__filename`
- **`stream/promises`** — native promisified streams without wrappers
- **Static analysis** — bundlers understand file paths and dependencies
- **Named exports** — explicit imports from `fs`, `path`, `stream`
- **Node.js default** — Node 20+ prefers ESM. CommonJS is legacy.

## The Migration

### 1. Add `"type": "module"` to `package.json`

```json
{
  "name": "m06-file-uploader",
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
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// After
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
```

### 3. Handle `__dirname`

```ts
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(process.cwd(), 'uploads');
```

### 4. Change `module.exports` to `export`

```ts
// Before
module.exports = app;

// After
export default app;
```

### 5. Update `tsconfig.json`

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

### 6. Add `.js` to relative imports

```ts
// Before
import uploadRouter from './routes/upload';

// After
import uploadRouter from './routes/upload.js';
```

## What Changed

- `"type": "module"` in `package.json`
- `require` → `import`
- `module.exports` → `export default`
- `tsconfig.json` uses `"module": "NodeNext"`
- Relative imports include `.js` extension
- `__dirname` replaced with `import.meta.url` + `fileURLToPath`
- Native promisified streams via `stream/promises`

## What We Still Need

We've built a typed, validated, tested, ESM application. Now we need to see the final structure and understand how all the pieces fit together.

For that, we need the production setup.
