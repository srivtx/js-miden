# S22 Push Notifications — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your push notification project uses a mix:

```json
// package.json
"type": "module",
"test": "node --test tests/**/*.test.ts"
```

**Problems:**
1. Node.js test runner with TypeScript requires loaders or transpilation
2. `require()` might still exist in test setup files
3. No top-level await — can't load device tokens from an async source
4. File extensions are implicit — `import './service'` might resolve to `.js` or `.ts` unpredictably

## The Fix: Full ESM Alignment

The project already has `"type": "module"` in `package.json`. The final step is aligning everything:

```json
// package.json
{
  "name": "s22-push-notifications",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "node --watch --loader ts-node/esm src/index.ts",
    "test": "node --test tests/**/*.test.ts"
  }
}
```

```ts
// service.ts
import { DeviceToken, PushNotification, PushResult } from './types.js';

export async function registerToken(data: { token: string; platform: 'ios' | 'android'; userId?: string }): Promise<DeviceToken> {
  // ...
}

export async function sendPush(data: { title: string; body: string; tokens: string[] }): Promise<PushNotification> {
  // ...
}
```

```ts
// index.ts
import express from 'express';
import { router } from './routes.js';

const app = express();
app.use(express.json());
app.use('/notifications', router);

export { app };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Push notification service running on port ${PORT}`);
  });
}
```

**What full ESM gives you:**
- No `--loader` hacks in production
- `import.meta.url` for self-execution guards
- Named exports are first-class — `export { registerToken, sendPush }`
- File extensions are explicit — `./types.js`

## The Pain That Remains

You have TypeScript, validation, logging, tests, and ESM. But `service.ts` mixes token storage, provider selection, and batch logic. `index.ts` mixes HTTP routing with service startup. Time to clean up.

## What v7 Fixes

Final production setup. Clean `src/` directory, proper provider separation, and queue handling.
