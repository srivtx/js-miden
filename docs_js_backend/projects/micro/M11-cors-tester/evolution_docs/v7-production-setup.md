# v7-production-setup.md — CORS Tester

## Final Production Setup

After evolving through 6 versions, here's the production-ready setup connecting to `src/`:

### `src/app.ts` (Current — with intentional bug for learning)
```typescript
import express from 'express';
import cors from 'cors';
import { publicRouter, privateRouter } from './routes.js';

const app = express();
app.use(express.json());

// Public routes: open CORS, no credentials
app.use('/public', cors(), publicRouter);

// Private routes: BUGGY - wildcard origin with credentials enabled
app.use('/private', cors({ origin: '*', credentials: true }), privateRouter);

export default app;
```

### `src/routes.ts`
```typescript
import { Router } from 'express';

export const publicRouter = Router();
publicRouter.get('/', (_req, res) => {
  res.json({ message: 'Public data', timestamp: Date.now() });
});

export const privateRouter = Router();
privateRouter.get('/', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }
  res.json({ message: 'Private data', user: 'admin' });
});
```

### What a Production Fix Looks Like

```typescript
import express from 'express';
import cors from 'cors';
import { publicRouter, privateRouter } from './routes.js';

const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = ['https://app.example.com', 'https://admin.example.com'];

// Public: any origin, no credentials
app.use('/public', cors(), publicRouter);

// Private: allowlist origin, credentials enabled, preflight cached
app.use('/private', cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 600,
}), privateRouter);
```

### Evolution Summary

| Version | Added | Bug Caught / Pain Solved |
|---------|-------|--------------------------|
| v1 | No CORS | API unusable from browsers |
| v2 | TypeScript + cors | Catches config typos, typed options |
| v3 | Runtime origin validation | Rejects evil.com, allows app.example.com |
| v4 | Structured logging | Tracks rejected origins, preflight cache |
| v5 | Tests | Documents wildcard+credentials bug |
| v6 | ESM | Top-level await for dynamic origin loading |
| v7 | Production (allowlist + credentials) | Secure CORS, cached preflight, `Vary: Origin` |

### Key Takeaway

CORS is a browser security feature that is invisible to server-side tools. The most dangerous CORS bug (`origin: '*' + credentials: true`) passes all server tests and only fails in browser dev tools. Testing CORS requires understanding both HTTP headers and browser enforcement. The production fix uses an explicit allowlist, never wildcards with credentials, and sets `Vary: Origin` for CDN compatibility.
