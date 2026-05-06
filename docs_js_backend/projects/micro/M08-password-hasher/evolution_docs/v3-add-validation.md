# v3-add-validation.md — Password Hasher

## The Pain

TypeScript (v2) caught typos, but it can't validate **runtime data** from the network:

```typescript
app.post('/hash', (req, res) => {
  const { password } = req.body as HashRequest;
  // What if the client sends: { password: 12345 } ?
  // TypeScript believes it's a string. At runtime, it's a number.
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  // TypeError: The "data" argument must be of type string or an instance of Buffer
});
```

1. `as HashRequest` is a **type assertion** — it tells TypeScript to trust us. It does zero validation.
2. Missing `password` field? `undefined` is passed to `update()`.
3. Empty string password? Accepted silently.

## The Fix: Add Runtime Validation

```typescript
// validation.ts
import { z } from 'zod';

export const hashSchema = z.object({
  password: z.string().min(1, 'Password cannot be empty'),
});

export const verifySchema = z.object({
  password: z.string().min(1),
  hash: z.string().min(1),
});
```

```typescript
// routes.ts
import { hashSchema, verifySchema } from './validation.js';

app.post('/hash', (req, res) => {
  const parse = hashSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const { password } = parse.data;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  res.json({ hash });
});
```

Now the API rejects:
```bash
curl -X POST http://localhost:3000/hash -d '{"password":123}'
# { "error": { "fieldErrors": { "password": ["Expected string, received number"] } } }

curl -X POST http://localhost:3000/hash -d '{"password":""}'
# { "error": { "fieldErrors": { "password": ["Password cannot be empty"] } } }
```

## But Validation Doesn't Fix Security

We still use SHA-256 (fast, unsalted) and `===` comparison (timing attack). Validation only ensures the input **shape** is correct. It doesn't make the hash algorithm secure.

> **Lesson:** TypeScript validates developer intent. Zod validates user intent. Neither replaces a secure algorithm.
