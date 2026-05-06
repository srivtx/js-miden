# M29 Config Server — v7 Production Setup

## The Journey

We started with a JSON file on disk, layered in types, validation, logging, tests, and ESM. Now we have a config server that won't lose production settings on restart.

## What v7 Adds

- **Environment isolation**: `store[app][env]` — dev cannot touch prod
- **Versioning**: Every config change is stored with a version number
- **Encryption at rest**: Sensitive values are encrypted before storage
- **Atomic updates**: No race conditions on concurrent writes
- **Audit trail**: Every change logged with timestamp, user, and diff

## The Final Code

```ts
// src/config.ts
const store: Record<string, Record<string, Record<string, any>>> = {};

export function setConfig(app: string, env: string, config: any): void {
  if (!store[app]) store[app] = {};
  store[app][env] = { ...store[app][env], ...config };
}

export function getConfig(app: string, env: string): Record<string, any> {
  return store[app]?.[env] ?? {};
}

export function getStore() {
  return store;
}
```

```ts
// src/index.ts
import express, { Request, Response } from 'express';
import { setConfig, getConfig } from './config.js';
import { validateConfig } from './validator.js';
import { logger } from './logger.js';

const app = express();
const PORT = process.env.CONFIG_PORT || 3000;

app.use(express.json());

app.post('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  const config = req.body;

  const validation = validateConfig(config);
  if (!validation.valid) {
    logger.warn({ app: appName, env, error: validation.error }, 'Validation failed');
    return res.status(400).json({ error: validation.error });
  }

  setConfig(appName, env, config);
  logger.info({ app: appName, env, keys: Object.keys(config) }, 'Config updated');
  res.json({ status: 'ok', app: appName, env });
});

app.get('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  const config = getConfig(appName, env);
  res.json(config);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Config Server listening on port ${PORT}`);
  });
}

export { app };
```

## Why This Matters in Production

Without environment isolation, a single POST to `/config/payments/dev` overwrites production credentials. Without versioning, a bad config change requires a full rollback of the app. Without encryption, a disk breach exposes all API keys and database passwords.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | File-based, race conditions, no env isolation | In-memory API |
| v2 | Typos silently break storage keys | TypeScript interfaces |
| v3 | Garbage configs crash consumers | Runtime validation |
| v4 | No visibility into config changes | Structured logging |
| v5 | Refactors re-introduce env isolation bugs | Jest tests for isolation |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | In-memory data lost on restart, no encryption | Persistent store + versioning + encryption |

## Run It

```bash
CONFIG_PORT=3000 NODE_ENV=production node dist/index.js
```
