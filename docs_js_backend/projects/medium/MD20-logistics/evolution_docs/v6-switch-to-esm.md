# MD20 Logistics — v6 Switch to ESM

## Goal
Modernize module system to ES Modules.

## Changes from v5
- `"type": "module"` in `package.json`
- All `require()` → `import`
- All `module.exports` → `export`
- `__dirname` via `import.meta.url`
- `tsconfig.json`: `"module": "NodeNext"`

## Migration Example

### Before
```javascript
const express = require('express');
module.exports = { app };
```

### After
```typescript
import express from 'express';
export { app };
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
- Top-level await in config
- Tree-shaking support
- Future-proof for Node.js 22+

## Still Missing
- No Docker or production hardening
- SQLite not suitable for high-volume tracking
