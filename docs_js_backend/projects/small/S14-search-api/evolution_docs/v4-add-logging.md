# S14 Search API — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"Search for 'graphql' returns results but the best match is on page 3."*

You check the code. It looks correct. You have zero visibility into:

- What query did the client send?
- How many results matched?
- How long did the query take?
- Was the GIN index used?

```ts
// Without logging — silent underperformance
router.get('/search', async (req, res) => {
  const result = await pool.query(`SELECT ...`);
  res.json({ results: result.rows });
});
```

## The Fix: Structured Logging

```ts
// routes/search.ts
import { logger } from '../logger.js';

router.get('/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const offset = (page - 1) * limit;
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  logger.debug({ requestId, query: q, page, limit }, 'Search request');

  if (!q || q.trim().length === 0) {
    logger.warn({ requestId }, 'Empty search query');
    res.status(400).json({ error: 'Query parameter q is required' });
    return;
  }

  const start = Date.now();
  const result = await pool.query(
    `SELECT id, title, content
     FROM documents
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [q, limit, offset]
  );
  const duration = Date.now() - start;

  logger.info({ requestId, query: q, results: result.rowCount, durationMs: duration }, 'Search completed');

  res.json({ results: result.rows, pagination: { page, limit } });
});
```

Now your logs tell the story:
```json
{"level":"info","requestId":"abc","query":"graphql","results":150,"durationMs":45,"msg":"Search completed"}
{"level":"warn","requestId":"def","query":"","msg":"Empty search query"}
```

Wait — the query takes 45ms but returns 150 results sorted by `created_at DESC`. The most relevant result is not first. The log reveals the missing ranking bug.

## The Pain That Remains

You add ranking with `ts_rank_cd` but forget to handle the case where `highlighted` is `null` for documents with no matches. Your test with a matching query passes, but the null case breaks. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
