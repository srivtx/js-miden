# MD16 Food Delivery — v6 Switch to ESM

## Goal
Move from CommonJS to ES Modules for top-level await, tree-shaking, and alignment with modern Node.js.

## Changes from v5
- `"type": "module"` in `package.json`
- All `require()` → `import`
- All `module.exports` → `export`
- `__dirname` → `import.meta.url` helper
- `tsconfig.json`: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`

## Migration Example

### Before (CommonJS)
```javascript
const express = require('express');
const { db } = require('./db');
module.exports = { app };
```

### After (ESM)
```typescript
import express from 'express';
import { db } from './db.js';
export { app };
```

### `__dirname` Replacement
```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Benefits
- `import` maps enable cleaner path aliasing (`#utils/logger`)
- Top-level await in `src/utils/prisma.ts`
- Future-proof for Node.js 22+ default ESM behavior

## Still Missing
- No Docker image
- `npm start` runs `tsc` then `node dist/app.js` — no process manager
