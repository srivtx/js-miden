# v6 — Switch to ESM (Weather Cache)

## The Scenario

It's 2am. Your junior wants to use `node-fetch` v3 for the weather API client. "It's the standard," they say. They install it. They `require('node-fetch')`. Node throws `ERR_REQUIRE_ESM`. They look at `node-fetch` docs. "ESM only." They sigh.

## The PAIN: Modern HTTP Clients Are ESM-Only

From v5:

```typescript
// Using built-in fetch (Node 18+) works in both,
// but many utilities around it are ESM-only:

// This fails in CommonJS:
import { retry } from 'some-retry-lib'; // ESM-only
```

Even if your core code works, the ecosystem is moving to ESM. Every new package you want to add becomes a potential module system conflict.

## The Solution: Clean ESM Setup

### 1. package.json

```json
{
  "name": "s03-weather-cache",
  "version": "1.0.0",
  "description": "Weather API with Redis cache-aside and stale-while-revalidate fallback",
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

### 3. Source files

```typescript
// src/index.ts
import app from './app.js';
import { PORT } from './config.js';

app.listen(PORT, () => {
  console.log(`S03 Weather Cache API running on port ${PORT}`);
});
```

```typescript
// src/routes/weather.ts
import { Router, Request, Response } from 'express';
import { getCachedWeather, setCachedWeather } from '../services/cache.js';
import { fetchWeatherFromApi } from '../services/weatherApi.js';
import { WeatherData } from '../types.js';
import { STALE_THRESHOLD_MS } from '../config.js';
```

### 4. Dynamic imports for conditional loading

```typescript
// If you need to conditionally import an ESM-only diagnostic tool:
if (process.env.NODE_ENV === 'development') {
  const { whyIsNodeRunning } = await import('why-is-node-running');
  whyIsNodeRunning();
}
```

ESM dynamic imports are native async. No `require()` fallback needed.

## The PAIN of `import.meta.url`

```typescript
// CommonJS:
const configPath = path.join(__dirname, '../config.json');

// ESM:
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '../config.json');
```

More verbose. More explicit. Also more correct — `import.meta.url` is a standard web API, not a Node quirk.

## ESM Evolution in Weather Cache

| Version | Module system | Future-proof? |
|---------|--------------|--------------|
| v1-5 | CommonJS | ❌ Breaking on new packages |
| v6 | ESM | ✓ Native web standard |

## The Realization

> Junior: "Why does every file need `.js` extensions when they're `.ts` files?"
> 
> You: "Because TypeScript doesn't run in production. Node runs JavaScript. The import path must be valid for the compiled output, not the source. Think in runtime, not compile-time."

## The Next PAIN

ESM works. But your Redis connection is hardcoded to `redis://localhost:6379`. You deploy to production. There's no Redis on localhost. Cache misses hit the API every time. Your quota burns. Your latency spikes.

## Next: v7 — Production Setup
