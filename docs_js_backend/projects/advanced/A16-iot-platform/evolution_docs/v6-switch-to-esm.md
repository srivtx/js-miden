# v6 — Switch to ESM (IoT Platform)

## The Scenario

It's 2am. Your junior adds a new dependency. "It's ESM-only," they say. They `require()` it. Node throws:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported.
```

They try `import()`. TypeScript complains. They try dynamic import. Tests break. They spend 3 hours in `tsconfig.json` hell.

## The PAIN: CommonJS Is Legacy

From v5, our tests might look like:

```javascript
// package.json (CommonJS)
{
  "main": "dist/index.js",
  // No "type" field = CommonJS default
}
```

```typescript
// tsconfig.json (CommonJS)
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node"
  }
}
```

```typescript
// src/routes/telemetry.routes.ts (CommonJS style)
import { Router } from 'express'; // TypeScript transpiles to require()
```

### What breaks:

1. **ESM-only packages**: Modern libraries (node-fetch v3, chalk v5, etc.) are ESM-only. Can't `require()` them.

2. **`.js` extension confusion**: TypeScript compiles `import './types'` to `require('./types')`. But in ESM, you must write `import './types.js'` — even for `.ts` files.

3. **`__dirname` doesn't exist**: In ESM, `__dirname` is undefined. You need `import.meta.url` + `fileURLToPath` + `dirname`.

4. **Dynamic imports are async**: `const pkg = await import('pkg')` instead of `const pkg = require('pkg')`. Changes sync code to async.

5. **Test runner config**: Vitest needs different settings for ESM. Mocks work differently.

## The Solution: Full ESM Setup

### 1. package.json

```json
{
  "name": "a16-iot-platform",
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

`"type": "module"` makes ALL `.js` files ESM. No more ambiguity.

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
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

Key changes:
- `"module": "NodeNext"` — tells TypeScript to use ESM output
- `"moduleResolution": "NodeNext"` — enforces ESM import rules

### 3. Source files with `.js` extensions

```typescript
// src/routes/telemetry.routes.ts
import { Router } from 'express';

// MUST use .js extension, even for .ts files
import { logger } from '../utils/logger.js';
import { mqttService } from '../services/mqtt.service.js';
import type { TelemetryReading, Device } from '../types/telemetry.types.js';
```

Yes, it feels wrong. TypeScript knows `logger.js` is actually `logger.ts`. But ESM requires the extension.

### 4. __dirname replacement (if needed)

```typescript
// If you need __dirname in ESM:
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
```

## The PAIN of Mixed Modules

```typescript
// DON'T mix require and import:
const express = require('express'); // CommonJS
import { mqttService } from '../services/mqtt.service.js'; // ESM
// Node gets confused. Pick one.

// DO use only ESM:
import express from 'express';
import { mqttService } from '../services/mqtt.service.js';
```

## ESM Evolution in the IoT Platform

| Version | Module system | Can use modern packages? |
|---------|--------------|------------------------|
| v1-5 | CommonJS (implied) | ❌ ESM-only packages break |
| v6 | ESM (`"type": "module"`) | ✓ All packages work |

## The Realization

> Junior: "Why do I have to write `.js` extensions in my `.ts` files?"
>
> You: "Because ESM is browser-native, and browsers don't know about `.ts`. TypeScript is a compile-time fiction. The runtime sees `.js`. Write what the runtime sees. In an IoT platform, module resolution failures during a factory emergency are not an option."

## The Next PAIN

ESM works. TypeScript compiles. Tests run. But your telemetry is still in-memory arrays. Your `.env` file has no time-series database URL. You deploy to a cloud instance. The filesystem is ephemeral. Your sensor history vanishes on every deploy.

## Next: v7 — Production Setup
