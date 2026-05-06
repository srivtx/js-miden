# v6 — Switch to ESM

Your API marketplace has 6 services. CommonJS `require()` is causing shared package import issues. Monorepo tooling (Turborepo, pnpm workspaces) works best with ESM.

## Pain #1: Shared Package Hell

```javascript
// CommonJS in gateway
const { API } = require('@shared/types');
// @shared/types is a local package. CommonJS resolution is inconsistent
// across pnpm, npm, and yarn workspaces.
```

The gateway service can't find `@shared/types` in production. The Docker build doesn't copy the shared package correctly. You end up copying files manually.

## Pain #2: No Top-Level Config Loading

```javascript
// CommonJS
const config = require('./config');
// config.js tries to read env vars and async load secrets
// But require() is synchronous. You can't await.
```

Your billing service needs to load Stripe API keys from AWS Secrets Manager. In CommonJS, you have to defer initialization to the first request. The first request is slow.

## Pain #3: Microservice Import Inconsistency

```javascript
// Auth service (CommonJS)
const express = require('express');

// Gateway service (you tried ESM here)
import express from 'express';
// Now you have two module systems in one repo.
// Jest configs are different. Build steps are different.
```

Half your services are CommonJS, half are ESM. Shared utilities need dual exports. Maintenance is a nightmare.

## The Fix: ESM Across All Services

### Root package.json

```json
{
  "type": "module",
  "private": true,
  "workspaces": ["services/*", "shared"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

### shared/package.json

```json
{
  "name": "@apihub/shared",
  "type": "module",
  "exports": {
    "./types": "./dist/types/index.js",
    "./utils": "./dist/utils/index.js",
    "./validation": "./dist/validation/index.js"
  }
}
```

### services/gateway/package.json

```json
{
  "name": "@apihub/gateway",
  "type": "module",
  "dependencies": {
    "@apihub/shared": "workspace:*",
    "express": "^5.0.0"
  }
}
```

### Source Files

```typescript
// services/gateway/src/index.ts
import express from 'express';
import { createRequestLogger } from '@apihub/shared/utils';
import { ProxyRequestSchema } from '@apihub/shared/validation';

const app = express();
const PORT = process.env.PORT || 3000;

// Top-level await for config
const config = await loadConfig();

app.use((req, res, next) => {
  req.logger = createRequestLogger(req);
  next();
});

app.all('/proxy/:apiId/*', async (req, res) => {
  const result = ProxyRequestSchema.safeParse({
    apiKey: req.headers['x-api-key'],
    endpoint: req.params[0],
    method: req.method,
  });
  
  if (!result.success) {
    req.logger.warn({ errors: result.error.issues }, 'Invalid proxy request');
    return res.status(400).json({ error: 'Invalid request' });
  }
  
  // ... proxy logic
});

app.listen(PORT, () => {
  console.log(`Gateway on port ${PORT}`);
});
```

```typescript
// services/billing/src/routes/invoices.ts
import { Router } from 'express';
import { Invoice, SubscriptionTier } from '@apihub/shared/types';
import { logger } from '@apihub/shared/utils';

const router = Router();

router.post('/calculate', async (req, res) => {
  const log = logger.child({ apiKeyId: req.body.apiKeyId });
  
  // Async config loading is fine in ESM
  const stripeConfig = await getStripeConfig();
  
  // ... calculation logic
});
```

## What Changed

1. **Workspace consistency** — All 6 services use ESM. Shared packages import cleanly.
2. **Monorepo tooling** — Turborepo caches builds and runs tests in dependency order.
3. **Async initialization** — Services load config and secrets before accepting requests.
4. **Tree shaking** — Production bundles exclude unused shared code.

## ESM for Microservices

In a 6-service marketplace, module consistency is critical. ESM provides:
- **One module system** — No CommonJS/ESM interop bugs
- **Workspace support** — pnpm/yarn/npm workspaces work natively
- **Build caching** — Turborepo can cache ESM builds reliably
- **Future-proofing** — New libraries are ESM-first

## Next Pain

Services start but there's no graceful shutdown. In-flight billing calculations are dropped. API keys are left in an inconsistent state. You need production setup.
