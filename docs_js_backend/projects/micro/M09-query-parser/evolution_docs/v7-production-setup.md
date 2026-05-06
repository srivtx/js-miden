# v7-production-setup.md — Query Param Parser

## Final Production Setup

After evolving through 6 versions, here's the production-ready setup connecting to `src/`:

### `src/index.ts`
```typescript
import express from 'express';
import { searchRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', searchRouter);

export { app };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M09 Query Parser listening on port ${PORT}`);
  });
}
```

### `src/routes.ts` (Current — with intentional bugs for learning)
```typescript
import { Router } from 'express';

export const searchRouter = Router();

searchRouter.get('/search', (req, res) => {
  // BUG: Query params are read as raw strings without coercion.
  const rawQuery = req.query.query || '';
  const rawPage = req.query.page || '1';
  const rawLimit = req.query.limit || '10';

  // BUG: No validation. page=-1, limit=99999999 accepted.

  // BUG: Arithmetic on strings using the + operator.
  // "1" + 1 becomes "11" instead of 2.
  const nextPage = rawPage + 1;

  // BUG: User input reflected directly into HTML without escaping.
  // Creates a reflected XSS vulnerability.
  res.set('Content-Type', 'text/html');
  res.status(200).send(`
    <!doctype html>
    <html>
      <head><title>Search</title></head>
      <body>
        <h1>Search Results</h1>
        <p>Query: ${rawQuery}</p>
        <p>Page: ${rawPage}</p>
        <p>Limit: ${rawLimit}</p>
        <p>Next Page: ${nextPage}</p>
      </body>
    </html>
  `);
});
```

### What a Production Fix Looks Like

```typescript
import { Router } from 'express';
import { z } from 'zod';
import escapeHtml from 'escape-html';

const searchSchema = z.object({
  query: z.string().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const searchRouter = Router();

searchRouter.get('/search', (req, res) => {
  const parse = searchSchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const { query, page, limit } = parse.data;
  const nextPage = page + 1;

  // Return JSON (client sanitizes) OR escape HTML output
  res.json({ query, page, limit, nextPage });

  // If HTML is required:
  // res.set('Content-Type', 'text/html');
  // res.send(`<p>Query: ${escapeHtml(query)}</p>`);
});
```

### Evolution Summary

| Version | Added | Bug Caught / Pain Solved |
|---------|-------|--------------------------|
| v1 | Pure JS (manual split) | String concat, no validation, XSS |
| v2 | TypeScript | Catches typos, enforces string types |
| v3 | Validation (Zod) | Rejects negative page, huge limit |
| v4 | Structured logging | Tracks XSS attempts, DoS probes |
| v5 | Tests | Documents string-concat bug; prevents XSS regression |
| v6 | ESM | Named imports from `escape-html`, top-level await |
| v7 | Production (Zod + escape-html) | Coerced types, bounded values, safe output |

### Key Takeaway

Query parameter handling is deceptively simple. The bugs (string concat, XSS, DoS) don't crash the server — they corrupt data, steal sessions, and enable attacks. Each evolution layer catches a different bug class. The final solution uses Zod for coercion+validation and explicit output encoding for XSS prevention.
