# S14 Search API — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl "http://localhost:3000/search?q=a&limit=1000000"
curl "http://localhost:3000/search"
curl "http://localhost:3000/search?q=running"
```

Your endpoints:
- Accept `limit=1000000` → memory exhaustion
- Accept empty query → full table scan
- Search for "running" and miss "run" → no stemming
- Return results in insertion order → no relevance ranking

## The Fix: PostgreSQL tsvector

```ts
// db.ts
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
```

```ts
// routes/search.ts
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
```

**What this prevents:**
- Full table scans via GIN index
- Empty queries via validation
- Unbounded responses via `LIMIT`/`OFFSET`

## The Pain That Remains

Search for "running" and you find documents with "run" thanks to `tsvector`. But the most relevant document (title contains "running", content is about running) is buried on page 3 because you sort by `created_at DESC`, not relevance.

## What v4 Fixes

Logging. Production without logs is flying blind.
