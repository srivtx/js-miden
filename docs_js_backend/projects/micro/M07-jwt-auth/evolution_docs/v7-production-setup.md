# v7-production-setup.md — "The final version"

## The Journey

We started with plaintext passwords:

```js
users.set(username, password);
```

A database breach published every password. Then we added SHA-256. It was too fast — GPUs cracked it in hours. Then we added JWTs. But we disabled expiry checking. Stolen tokens worked forever.

Here's what we added and why:

| Step | What we added | What bug it prevents |
|------|--------------|----------------------|
| v1 | Plaintext passwords | Database breach = game over |
| v2 | TypeScript | `req.body.pasword` → caught at compile time |
| v3 | Zod validation | `{ userId: "", password: "" }` → 400 with errors |
| v4 | Pino logging | Mystery 401s → searchable JSON with context |
| v5 | Vitest + Supertest | `ignoreExpiration: true` → caught in CI |
| v6 | ESM | `require` cycles, no top-level await → gone |
| v7 | Production setup | Everything wired, intentional bug to find |

## Final File Structure

```
M07-jwt-auth/
├── src/
│   ├── server.ts         # Entry point: wire routes
│   └── routes/
│       └── auth.ts       # Login, token generation, verification
├── tests/
│   └── auth.test.ts      # Vitest: login, protected, expiry, algorithm
├── package.json          # ESM, scripts, dependencies
├── tsconfig.json         # strict, NodeNext module resolution
└── evolution_docs/       # This file and the journey
```

## Each File Explained

### `src/server.ts`

```ts
import express from 'express';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', authRouter);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M07 server running on http://localhost:${PORT}`);
  });
}

export default app;
```

- Simple wiring: auth router handles all routes
- `NODE_ENV !== 'test'` prevents server from starting in tests

### `src/routes/auth.ts`

```ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

router.post('/login', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const token = jwt.sign({ sub: userId }, SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256',
  });

  res.json({ token });
});

router.get('/protected', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
      ignoreExpiration: true,  // <-- BUG IS HERE
    });

    res.json({ message: 'Access granted', user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
```

- `jwt.sign` creates a token with expiry
- `jwt.verify` checks the signature and algorithm
- `ignoreExpiration: true` disables expiry checking

## The Intentional Bug

`ignoreExpiration: true` tells `jwt.verify` to accept tokens even after they've expired. A token that expired days ago, weeks ago, or years ago is still valid.

This means:
- Stolen tokens work forever
- Former employees retain access forever
- Compromised accounts can't be fixed by waiting for expiry

The test `returns 401 with an expired token` fails because of this.

**Fix:** Remove `ignoreExpiration: true`:

```ts
const decoded = jwt.verify(token, SECRET, {
  algorithms: ['HS256'],
  // ignoreExpiration removed — defaults to false
});
```

## Running It

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Why This Matters

Security bugs are often a single boolean away. `ignoreExpiration: true` is one option in a function call. It looks harmless. It destroys your security model.

The bug is intentional. Find it. Fix it. The lesson: never disable security checks. If a token expires, it's expired. Period.
