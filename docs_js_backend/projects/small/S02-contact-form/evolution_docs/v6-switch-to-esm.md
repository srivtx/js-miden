# v6 — Switch to ESM (Contact Form)

## The Scenario

It's 2am. Your junior installs `helmet` v8. "It's ESM-only now," they say. They add `const helmet = require('helmet')` to the app. Node crashes with `ERR_REQUIRE_ESM`. They try `import helmet from 'helmet'`. TypeScript complains under CommonJS mode.

## The PAIN: Security Libraries Are Going ESM-Only

From v5:

```javascript
// CommonJS package.json
{
  "main": "dist/index.js"
  // No "type": "module"
}
```

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "module": "CommonJS"
  }
}
```

```typescript
// app.ts (compiled to require())
import express from 'express'; // TypeScript transpiles to require('express')
import helmet from 'helmet';   // helmet v8 is ESM-only -> CRASH
```

### What breaks:

1. **Helmet v8+ is ESM-only**: A security middleware you probably want is now unreachable from CommonJS.

2. **IORedis works but warns**: Mixed CJS/ESM interop causes subtle bugs with default exports.

3. **Validator package**: Works in both, but types assume CommonJS structure.

4. **Supertest in tests**: Mocking ESM modules in Vitest requires different syntax than Jest.

## The Solution: Full ESM Migration

### 1. package.json

```json
{
  "name": "s02-contact-form",
  "version": "1.0.0",
  "description": "Contact form backend with validation, rate limiting, and GDPR awareness",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
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
// src/app.ts
import express from 'express';
import helmet from 'helmet';
import contactRouter from './routes/contact.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(helmet());
app.use(express.json());
app.use('/', contactRouter);
app.use(errorHandler);

export default app;
```

```typescript
// src/index.ts
import app from './app.js';
import { PORT } from './config.js';

app.listen(PORT, () => {
  console.log(`S02 Contact Form API running on port ${PORT}`);
});
```

### 4. Importing CommonJS packages in ESM

Some packages (like `validator`) are still CommonJS:

```typescript
// src/middleware/validator.ts
import validator from 'validator';
// ESM can import CJS default exports seamlessly

// Named exports from CJS need care:
import Redis from 'ioredis';
// ioredis exports a default class that works in ESM
```

## The PAIN of Path Resolution

```typescript
// In CommonJS:
import { validateContact } from '../middleware/validator';
// Works. TypeScript resolves it.

// In ESM (NodeNext):
import { validateContact } from '../middleware/validator.js';
// REQUIRED. Node needs the extension.
```

VS Code will autocomplete without `.js`. You must add it manually. It's annoying. It's also correct.

## ESM Evolution in Contact Form

| Version | Module system | Can use helmet v8? |
|---------|--------------|-------------------|
| v1-5 | CommonJS | ❌ No |
| v6 | ESM | ✓ Yes |

## The Realization

> Junior: "I spent an hour fighting `ERR_REQUIRE_ESM` before I realized I just needed `"type": "module"` in package.json."
> 
> You: "That hour is the tax for using 2025 packages with a 2009 module system. Pay it once, move to ESM, never think about it again."

## The Next PAIN

ESM works locally. But your Redis connection points to `localhost:6379`. You deploy to a cloud platform. Redis is a managed service with a URL. Your rate limiter fails silently (fail open). You're now unprotected.

## Next: v7 — Production Setup
