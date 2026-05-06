# v2-add-typescript.md — Query Param Parser

## The Pain

In v1 (pure JS), we had two type-related bugs that tests caught but the code "worked":

```javascript
app.get('/search', (req, res) => {
  const page = req.query.page || '1';
  const limit = req.query.limit || '10';
  const nextPage = page + 1;  // string concat: "1" + 1 = "11"
});
```

1. `req.query.page` is typed as `string | string[] | QueryString.ParsedQs | undefined` in Express, but JS doesn't warn us.
2. `nextPage` should be a number, but JS happily concatenates strings.

## The Fix: Add TypeScript

```typescript
// routes.ts
import { Request, Response } from 'express';

interface SearchQuery {
  query?: string;
  page?: string;
  limit?: string;
}

app.get('/search', (req: Request, res: Response) => {
  const { query = '', page = '1', limit = '10' } = req.query as SearchQuery;
  // TypeScript now knows these are STRINGS

  const nextPage = parseInt(page, 10) + 1;  // correct: 1 + 1 = 2
  res.json({ query, page: parseInt(page, 10), limit: parseInt(limit, 10), nextPage });
});
```

TypeScript also catches typos:
```typescript
const { qery } = req.query as SearchQuery;
// error TS2339: Property 'qery' does not exist on type 'SearchQuery'
```

## But TypeScript Doesn't Catch Everything

TypeScript knows `page` is a `string`, but it can't validate that the string `"abc"` is invalid for pagination. Runtime validation (Zod, Joi) is still needed.

> **Lesson:** TypeScript turns runtime type bugs into compile-time errors. But it can't enforce business rules — only shapes.
