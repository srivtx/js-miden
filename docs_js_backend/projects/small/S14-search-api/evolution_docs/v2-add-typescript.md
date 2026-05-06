# S14 Search API — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add SQL LIKE search:

```js
app.get('/search', async (req, res) => {
  const q = req.query.q;
  const result = await pool.query(
    `SELECT id, title, content FROM documents WHERE content ILIKE '%' || $1 || '%'`,
    [q]
  );
  res.json({ results: result.rows });
});
```

**The bug:** `req.query.q` can be `undefined`. You concatenate `'%' || undefined || '%'` → `'%undefined%'`. Users searching with no query get documents containing the string "undefined".

Another bug: you treat `page` as a number but it's a string:

```js
const offset = page * limit; // "2" * 10 = 20 (works by accident), but "2" + 10 = "210"
```

TypeScript would flag `page` as `string | undefined`.

## The Fix: Add TypeScript

```ts
// types.ts
export interface Document {
  id: number;
  title: string;
  content: string;
  tsvector: string;
  created_at: Date;
}

export interface SearchResult {
  id: number;
  title: string;
  content: string;
  rank: number;
  highlights: string[];
}

export interface SearchRequest {
  q: string;
  page?: string;
  limit?: string;
}
```

```ts
// routes/search.ts
import { Router } from 'express';
import { pool } from '../db.js';
import type { Request, Response } from 'express';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const offset = (page - 1) * limit;

  if (!q || q.trim().length === 0) {
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  const result = await pool.query(
    `SELECT id, title, content FROM documents WHERE content ILIKE '%' || $1 || '%' LIMIT $2 OFFSET $3`,
    [q, limit, offset]
  );

  res.json({ results: result.rows, pagination: { page, limit } });
});
```

Now `tsc` errors on:
```
routes/search.ts:8:28 - error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** performance. A client can still:
- Send `q='a'` and trigger a full table scan
- Request `limit=1000000` and exhaust memory
- Search for "running" and miss "run" — no stemming
- Get unranked results — most relevant document is last

We need full-text search.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But database performance requires proper indexing and query design.

## What v3 Fixes

PostgreSQL `tsvector`. Proper full-text indexing and search.
