# v6 — Switch to ESM (Image Resizer)

## The Scenario

It's 2am. Your junior wants to add `image-size` for metadata validation. "It validates dimensions before Sharp processes," they say. They install it. It's ESM-only. Their CommonJS project rejects it. They spend an hour looking for a CJS alternative.

## The PAIN: Image Processing Ecosystem Is Moving to ESM

From v5:

```typescript
// CommonJS tsconfig
{
  "compilerOptions": {
    "module": "CommonJS"
  }
}
```

Packages in the image processing ecosystem (Sharp, image-size, file-type) are increasingly ESM-first. Sharp itself works in both, but its TypeScript types and documentation assume ESM patterns.

## The Solution: ESM for Binary Processing

### 1. package.json

```json
{
  "name": "s04-image-resizer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### 3. Source files with `.js` extensions

```typescript
// src/index.ts
import express from 'express';
import { router } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', router);

const PORT = process.env.PORT || 3000;
export const server = app.listen(PORT, () => {
  console.log(`S04 Image Resizer listening on ${PORT}`);
});

export { app };
```

```typescript
// src/routes.ts
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
```

### 4. Node.js built-in modules with `node:` prefix

```typescript
// ESM best practice:
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The `node:` prefix makes it explicit that these are built-ins.
// It also prevents malicious packages named `fs` from being imported.
```

## The PAIN of Multer in ESM

```typescript
// Multer is a tricky CJS package:
import multer from 'multer';
// Works because "esModuleInterop": true

// But types can be finicky:
const upload = multer({ storage }); // Type might complain about default export
```

With `"esModuleInterop": true` and `"moduleResolution": "NodeNext"`, most CJS packages import cleanly into ESM.

## ESM Evolution in Image Resizer

| Version | Module system | Package compatibility |
|---------|--------------|----------------------|
| v1-5 | CommonJS | ❌ Limited with modern packages |
| v6 | ESM | ✓ Full ecosystem access |

## The Realization

> Junior: "I added `node:` prefixes to all built-in imports. It feels more explicit."
> 
> You: "Good habit. It's like using `const` instead of `var` — it communicates intent. `node:` says 'this is from the runtime, not npm.'"

## The Next PAIN

ESM works. But your uploads go to `./uploads/` on the local filesystem. You deploy to a container. The filesystem is ephemeral. Upload a file, container restarts, file is gone. Users get 404s for their own uploads.

## Next: v7 — Production Setup
