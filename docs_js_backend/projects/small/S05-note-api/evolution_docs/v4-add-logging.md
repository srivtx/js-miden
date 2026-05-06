# v4 — Add Logging (Note API)

## The Scenario

It's 2am. Users report "search is broken." Your junior checks the search endpoint — it returns results. They check the database — data exists. They ask the user: "What did you search for?" The user: "database design." Your junior searches — it works. But the user's specific query? You'll never know. No logs.

## The PAIN: Debugging Search Is Impossible Without Logs

From v3:

```typescript
router.get('/notes', async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  if (q) {
    rows = await pool.query(
      `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE $1 LIMIT $2 OFFSET $3`,
      [`%${q}%`, limit, offset]
    );
  }
  res.json({ data: rows.rows });
});
```

### What breaks in production:

1. **No query history**: User says "search doesn't work." You can't see what they searched.

2. **No performance data**: `ILIKE '%term%'` on 100,000 notes takes 5 seconds. No log. You think search is fast.

3. **No result metrics**: How many results per query? Zero-result queries suggest missing content or bad search.

4. **No error context**: Database connection drops during search. Express might 500. Log? Maybe console. Maybe not.

## The Solution: Structured Logging for Search

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});
```

```typescript
// routes.ts
import { logger } from './logger.js';

router.get('/notes', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'GET /notes' });
  const startTime = Date.now();
  
  try {
    const parseResult = listQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      childLogger.warn({ issues: parseResult.error.issues }, 'Invalid search query');
      res.status(400).json({ error: 'Invalid query parameters' });
      return;
    }
    
    const { q, page, limit } = parseResult.data;
    const offset = (page - 1) * limit;
    
    childLogger.info({ query: q, page, limit }, 'Search initiated');
    
    let rows;
    let countResult;
    
    if (q) {
      rows = await pool.query(
        `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
        [`%${q}%`, limit, offset]
      );
      countResult = await pool.query(
        `SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL AND content ILIKE $1`,
        [`%${q}%`]
      );
    } else {
      rows = await pool.query(
        `SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY id LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      countResult = await pool.query(`SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL`);
    }
    
    const duration = Date.now() - startTime;
    const total = parseInt(countResult.rows[0].count, 10);
    
    childLogger.info({
      query: q,
      resultCount: rows.rows.length,
      total,
      durationMs: duration,
      page,
      limit,
    }, 'Search completed');
    
    res.json({
      data: rows.rows,
      pagination: { page, limit, total },
    });
  } catch (err) {
    childLogger.error({ err, query: req.query.q }, 'Search failed');
    res.status(500).json({ error: 'Search failed' });
  }
});
```

### What structured logging gives you:

| Need | console.log | Structured logger |
|------|------------|-------------------|
| Query history | ❌ No persistence | ✓ Searchable log entries |
| Performance trends | ❌ No timing | ✓ `durationMs` alerts when slow |
| Zero-result queries | ❌ Unknown | ✓ `resultCount: 0` pattern detection |
| Pagination abuse | ❌ No visibility | ✓ Track `page` values (bots scraping?) |
| Error root cause | ❌ Lost stack traces | ✓ Full context with query params |

## The PAIN of Search Performance

```sql
-- ILIKE '%term%' cannot use indexes
-- On 100,000 rows: 2-5 seconds
-- On 1,000,000 rows: timeout

-- Without logging:
-- Users complain "app is slow"
-- You have no idea search is the bottleneck

-- With logging:
-- `durationMs: 4500` for query "database"
-- Pattern emerges: ILIKE doesn't scale
```

Logging reveals performance problems before users complain.

## Logging Evolution in Note API

| Version | Logging | Search observability |
|---------|---------|---------------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral |
| v3 (Validation) | console.log | Same problems |
| v4 (Structured) | JSON with query metrics | Full visibility |

## The Realization

> Junior: "I added logging and saw that 40% of searches return zero results. Users are searching for terms we don't have. Time to improve content or add synonyms."
> 
> You: "Search logs are product analytics. They tell you what users want, not just what your code does. Zero-result queries are feature requests in disguise."

## The Next PAIN

Logging shows you problems. Testing prevents them. When you change from `ILIKE` to full-text search, how do you know results are still correct? You test it.

## Next: v5 — Add Testing
