# v7-production-setup.md — Password Hasher

## Final Production Setup

After evolving through 6 versions, here's the production-ready setup connecting to `src/`:

### `src/index.ts`
```typescript
import express from 'express';
import { hashRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', hashRouter);

export { app };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M08 Password Hasher listening on port ${PORT}`);
  });
}
```

### `src/routes.ts` (Current — with intentional bugs for learning)
```typescript
import { Router } from 'express';
import crypto from 'crypto';

export const hashRouter = Router();

hashRouter.post('/hash', (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string') {
    res.status(400).json({ error: 'password required' });
    return;
  }

  // BUG: Using SHA-256 (fast, general-purpose hash) without a salt.
  // Password hashes should use slow, memory-hard algorithms like bcrypt or Argon2.
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  res.json({ hash });
});

hashRouter.post('/verify', (req, res) => {
  const { password, hash } = req.body;
  if (typeof password !== 'string' || typeof hash !== 'string') {
    res.status(400).json({ error: 'password and hash required' });
    return;
  }

  const computed = crypto.createHash('sha256').update(password).digest('hex');

  // BUG: Standard string comparison is NOT constant-time.
  // An attacker can measure response-time differences to guess the hash byte-by-byte.
  const match = computed === hash;

  res.json({ match });
});
```

### What a Production Fix Looks Like

```typescript
import { hash, verify } from 'argon2';
import { timingSafeEqual } from 'crypto';

hashRouter.post('/hash', async (req, res) => {
  const { password } = req.body;
  const hashed = await hash(password, { type: argon2id, memoryCost: 65536 });
  res.json({ hash: hashed });
});

hashRouter.post('/verify', async (req, res) => {
  const { password, hash } = req.body;
  const match = await verify(hash, password);
  // Or for raw comparison:
  // const match = timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  res.json({ match });
});
```

### Evolution Summary

| Version | Added | Bug Caught / Pain Solved |
|---------|-------|--------------------------|
| v1 | Pure JS | Works but SHA-256 + `===` = insecure |
| v2 | TypeScript | Catches typos like `passwrod` |
| v3 | Validation (Zod) | Rejects `{ password: 123 }` at runtime |
| v4 | Structured logging | Visibility into brute-force attempts |
| v5 | Tests | Documents identical-hash bug; prevents regressions |
| v6 | ESM | Enables top-level await, named imports from argon2 |
| v7 | Production (Argon2 + timingSafeEqual) | Slow hash + constant-time compare |

### Key Takeaway

Password hashing is the canonical example of "simple code, hard security." The naive implementation looks correct, passes manual tests, and fails catastrophically under attack. Every layer of complexity (types, validation, logging, tests, ESM) was added because the previous layer couldn't catch a specific class of bug. The final fix (Argon2 + timingSafeEqual) is only possible because the infrastructure (ESM, tests, logging) supports it.
