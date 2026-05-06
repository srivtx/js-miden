# S14 Search API — v7 Production Setup

## The Journey

We started with no search, layered in types, SQL LIKE, PostgreSQL `tsvector`, validation, logging, tests, and ESM. Now we have full-text search that respects relevance and performance.

## What v7 Adds

- **tsvector indexing**: GIN index for sub-millisecond lookups
- **Stemming**: "running" matches "run" via `to_tsvector('english', ...)`
- **Relevance ranking**: `ts_rank_cd` sorts best matches first
- **Highlighting**: `ts_headline` shows matching snippets
- **Pagination**: Bounded `LIMIT`/`OFFSET` with total counts
- **SQL injection prevention**: Parameterized queries with `plainto_tsquery`

## The Final Code

```ts
// src/db.ts
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'search',
  password: process.env.DB_PASSWORD || 'searchpass',
  database: process.env.DB_NAME || 'searchdb',
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        search_vector tsvector,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_search 
      ON documents USING GIN(search_vector)
    `);
  } finally {
    client.release();
  }
}

export async function resetDb() {
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE documents RESTART IDENTITY');
  } finally {
    client.release();
  }
}

export { pool };
```

```ts
// src/routes/search.ts
import { Router } from 'express';
import { pool } from '../db.js';
import { logger } from '../logger.js';
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
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  if (!q || q.trim().length === 0) {
    logger.warn({ requestId }, 'Empty search query');
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  logger.debug({ requestId, query: q, page, limit }, 'Search request');

  const start = Date.now();
  const result = await pool.query(
    `SELECT 
      id,
      title,
      content,
      ts_rank_cd(search_vector, plainto_tsquery('english', $1), 32) as rank,
      ts_headline('english', content, plainto_tsquery('english', $1), 
        'MaxFragments=3, MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>'
      ) as highlighted
    FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1)
    ORDER BY rank DESC
    LIMIT $2 OFFSET $3`,
    [q, limit, offset]
  );

  const totalResult = await pool.query(
    `SELECT COUNT(*) as total FROM documents WHERE search_vector @@ plainto_tsquery('english', $1)`,
    [q]
  );

  const duration = Date.now() - start;
  logger.info({ requestId, query: q, results: result.rowCount, durationMs: duration }, 'Search completed');

  res.json({
    results: result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      rank: parseFloat(r.rank),
      highlights: r.highlighted ? [r.highlighted] : [],
    })),
    pagination: {
      page,
      limit,
      total: parseInt(totalResult.rows[0].total),
      pages: Math.ceil(parseInt(totalResult.rows[0].total) / limit),
    },
  });
});

export default router;
```

## Why This Matters in Production

Without `tsvector`, every search is a full table scan. Without stemming, users miss conjugated forms. Without ranking, the best match is buried. Without highlighting, users can't see why a result matched. Without pagination, unbounded responses exhaust memory. Without parameterized queries, SQL injection is trivial.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | No search | Basic document storage |
| v2 | Typos in query handling | TypeScript interfaces |
| v3 | Full table scans, no stemming | PostgreSQL `tsvector` + GIN index |
| v4 | No visibility into query performance | Structured logging |
| v5 | Silent breakage when adding ranking | Vitest tests for null highlights |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | No relevance ranking or highlighting | `ts_rank_cd` + `ts_headline` + pagination |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
