# v3-add-validation.md — Query Param Parser

## The Pain

TypeScript (v2) told us `req.query.page` is a string, but it didn't enforce business rules:

```typescript
app.get('/search', (req, res) => {
  const { page = '1', limit = '10' } = req.query as SearchQuery;
  const nextPage = parseInt(page, 10) + 1;  // NaN if page='abc'
  // Negative page? Accepted.  limit=99999999? Accepted.
});
```

1. `page=-5` passes through — pagination breaks.
2. `limit=99999999` passes through — a single request can try to allocate a massive result set (DoS).
3. `page=abc` becomes `NaN` — `NaN + 1` is still `NaN`, but we return it to the client.

## The Fix: Add Runtime Validation (Zod Coercion)

```typescript
// validation.ts
import { z } from 'zod';

export const searchSchema = z.object({
  query: z.string().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

```typescript
// routes.ts
import { searchSchema } from './validation.js';

app.get('/search', (req, res) => {
  const parse = searchSchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { query, page, limit } = parse.data;
  const nextPage = page + 1;  // now guaranteed to be a positive integer

  res.json({ query, page, limit, nextPage });
});
```

Now the API rejects:
```bash
curl 'http://localhost:3000/search?page=-1&limit=10'
# 400 Bad Request — page must be >= 1

curl 'http://localhost:3000/search?limit=99999999'
# 400 Bad Request — limit must be <= 100
```

## But Validation Doesn't Fix XSS

We still return HTML with unescaped user input. Even perfectly validated input like `query="<script>alert(1)</script>"` is valid text — and will execute in the browser.

> **Lesson:** Validation catches malformed data. But sanitization/escaping prevents malicious data from becoming malicious code.
