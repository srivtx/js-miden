# Step-by-Step Build Guide

## Step 1: Initialize the Project

```bash
mkdir M11-cors-tester
cd M11-cors-tester
npm init -y
```

Install dependencies:
```bash
npm install express cors
npm install -D typescript tsx @types/express @types/cors @types/node vitest supertest @types/supertest
```

**Why these packages:**
- `express`: HTTP framework.
- `cors`: Industry-standard CORS middleware.
- `vitest` + `supertest`: Testing framework and HTTP assertion library.

### Common Mistakes at This Step
- **Mistake:** Installing `cors` but not `@types/cors`.
  - **Why it breaks:** TypeScript cannot resolve `cors` types and compilation fails.
  - **How to avoid:** Always install matching `@types/` packages for TypeScript projects.

---

## Step 2: Configure TypeScript

Create `tsconfig.json`:
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
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Why:** `NodeNext` module resolution is required for ES modules with Node.js. `strict: true` catches CORS config type errors early.

### Common Mistakes at This Step
- **Mistake:** Using `"module": "CommonJS"` with `"type": "module"` in package.json.
  - **Why it breaks:** Mismatched module systems cause runtime `ERR_REQUIRE_ESM` or `ERR_MODULE_NOT_FOUND`.
  - **How to avoid:** Use `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` for ES module projects.

---

## Step 3: Create the Express App

Create `src/app.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { publicRouter, privateRouter } from './routes.js';

const app = express();
app.use(express.json());

// Public: open to any origin, no credentials
app.use('/public', cors(), publicRouter);

// Private: BUGGY - wildcard with credentials
app.use('/private', cors({ origin: '*', credentials: true }), privateRouter);

export default app;
```

Create `src/routes.ts`:
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

Create `src/index.ts`:
```typescript
import app from './app.js';
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`M11 CORS Tester running on http://localhost:${PORT}`);
});
```

**Why this structure:** Separating `app.ts` (the app object, for testing) from `index.ts` (the server bootstrap, for running) is the standard Express pattern. It lets tests import the app without starting a server.

### Common Mistakes at This Step
- **Mistake:** Writing `import './routes'` without `.js` extension.
  - **Why it breaks:** Node.js ES modules require explicit file extensions. TypeScript does NOT rewrite them.
  - **How to avoid:** Always include `.js` in ES module imports, even for `.ts` files.

---

## Step 4: Add Tests

Create `tests/cors.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('CORS Tester', () => {
  it('should allow any origin on public route', async () => {
    const res = await request(app)
      .get('/public')
      .set('Origin', 'https://evil.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('should handle preflight for public route', async () => {
    const res = await request(app)
      .options('/public')
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
  });

  it('should NOT use wildcard origin when credentials are enabled', async () => {
    const res = await request(app)
      .get('/private')
      .set('Origin', 'https://evil.com')
      .set('Authorization', 'Bearer secret-token');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});
```

**Why these tests:** The first two verify normal behavior. The third is a security test — it asserts that we do NOT send `*` with credentials. This test will FAIL with the buggy implementation, which is the point.

### Common Mistakes at This Step
- **Mistake:** Testing CORS without setting the `Origin` header.
  - **Why it breaks:** The `cors` middleware does nothing if there is no `Origin` header (e.g., same-origin requests or server-to-server). Your test would pass even with a broken config.
  - **How to avoid:** Always set `.set('Origin', 'https://something.com')` when testing CORS behavior.

---

## Step 5: Run and Verify

```bash
npm run dev      # Start server on :3000
npm test         # Run tests (the security test should fail)
```

Fix the bug by replacing the private CORS config:
```typescript
const ALLOWED_ORIGINS = ['https://app.example.com', 'https://admin.example.com'];

app.use('/private', cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}), privateRouter);
```

Run tests again. The security test now passes.

**Why this fix works:** The server now validates the origin before reflecting it. Untrusted origins receive no CORS headers, so the browser blocks the response. Trusted origins receive their exact origin echoed back, which satisfies the browser's credentials requirement.
