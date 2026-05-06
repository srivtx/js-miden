# MD17 Ride Sharing — v6 Switch to ESM

## Goal
Modernize module system to ES Modules for alignment with Node.js 20+ defaults.

## Changes from v5
- `"type": "module"` in `package.json`
- All `require()` → `import`
- All `module.exports` → `export`
- `__dirname` shim via `import.meta.url`
- `tsconfig.json`: `"module": "NodeNext"`

## Migration Example

### Before
```javascript
const express = require('express');
const { db } = require('./db');
module.exports = { app };
```

### After
```typescript
import express from 'express';
import { db } from './db.js';
export { app };
```

### `__dirname` Replacement
```typescript
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
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
- Top-level await in config files
- Tree-shaking for smaller bundles
- Aligns with Express 5 ESM support

## Still Missing
- No Docker or orchestration
- SQLite not suitable for concurrent driver matching
