# S14 Search API — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { Pool } = require('pg');

module.exports = router;
```

**Problems:**
1. No top-level await
2. `require()` loads synchronously and caches aggressively
3. Named exports are fragile
4. Modern packages ship ESM-only
5. `__dirname` and `__filename` are CJS-only

## The Fix: ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// src/index.ts
import 'dotenv/config';
import app from './app.js';
import { initDb } from './db.js';

const PORT = process.env.PORT || 3000;

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`S14 Search API listening on port ${PORT}`);
  });
}

main().catch(console.error);
```

```ts
// src/routes/search.ts
import { Router } from 'express';
import { pool } from '../db.js';
import type { Request, Response } from 'express';

const router = Router();

router.post('/index', async (req: Request, res: Response) => {
  const { title, content } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO documents (title, content, search_vector)
     VALUES ($1, $2, to_tsvector('english', $1 || ' ' || $2))
     RETURNING id, title, content, created_at`,
    [title, content]
  );

  res.status(201).json({ document: result.rows[0] });
});

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
    `SELECT id, title, content
     FROM documents
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [q, limit, offset]
  );

  res.json({ results: result.rows, pagination: { page, limit } });
});

export default router;
```

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, tsvector, validation, logging, tests, and ESM. But results are sorted by `created_at DESC`, not relevance. Users get the newest document first, not the best match. You need ranking, highlighting, and statistical significance in result quality.

## What v7 Fixes

Final production setup. Relevance ranking with `ts_rank_cd`, highlighting with `ts_headline`, and pagination with total counts.
