# v7 — Production Setup (Note API)

## The Scenario

It's 2am. Your junior deploys the note API. "Search works!" they say. Then a power user with 50,000 notes searches for "the." The query:

```sql
SELECT * FROM notes WHERE content ILIKE '%the%' LIMIT 10 OFFSET 0
```

This scans all 50,000 rows. Takes 8 seconds. Timeouts in production. "Why is search so slow?" the junior asks. You check: no indexes, no full-text search, just `ILIKE '%term%'` which can't use indexes.

## The PAIN: ILIKE Doesn't Scale

From v6:

```typescript
if (q) {
  rows = await pool.query(
    `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
    [`%${q}%`, limit, offset]
  );
}
```

### Problems with `ILIKE '%term%'`:

1. **No indexes**: Leading wildcard (`%term`) prevents index usage. Full table scan.
2. **Stop words**: Searching for "the" or "and" returns everything.
3. **No relevance**: Results are ordered by `id`, not by how well they match.
4. **No phrase matching**: "database design" matches "design patterns" equally.
5. **Case insensitive**: `ILIKE` is slower than case-sensitive comparisons.

## The Solution: PostgreSQL Full-Text Search

### 1. Database Schema

```sql
-- Current schema (supports soft delete)
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

### 2. Search with ILIKE (Current Implementation)

```typescript
// src/routes.ts (actual production code)
import { Router, type Request, type Response } from 'express';
import { pool } from './db.js';

export const router = Router();

router.get('/notes', async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const offset = (page - 1) * limit;

  let rows;
  let countResult;

  if (q) {
    // BUG: Direct string concatenation enables SQL injection via q parameter
    // (Fixed in v3 with parameterized queries, but ILIKE performance remains)
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

  res.json({
    data: rows.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
    },
  });
});
```

### 3. The Full-Text Search Evolution (Next Step)

The current code uses `ILIKE`. The next evolution is `tsvector`:

```sql
-- Add search vector column:
ALTER TABLE notes ADD COLUMN search_vector tsvector;

-- Create index:
CREATE INDEX idx_notes_search ON notes USING GIN(search_vector);

-- Update trigger (auto-maintains vector):
CREATE OR REPLACE FUNCTION notes_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.title || ' ' || NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION notes_search_update();
```

```typescript
// Query with ranking:
const result = await pool.query(
  `SELECT *, ts_rank(search_vector, query) as rank
   FROM notes, plainto_tsquery('english', $1) query
   WHERE deleted_at IS NULL AND search_vector @@ query
   ORDER BY rank DESC, id
   LIMIT $2 OFFSET $3`,
  [q, limit, offset]
);
```

Why not implemented yet?
- Requires schema migration
- More complex than ILIKE
- Current dataset is small enough that ILIKE works
- The BUG is documented for educational purposes

### 4. The SQL Injection Bug (Intentionally Documented)

Wait — the code shows parameterized queries. But the docs mention a bug:

```typescript
// The codebase has a COMMENT noting the original v1 bug:
// "BUG: Direct string concatenation enables SQL injection"
// 
// The actual code is FIXED in v7:
rows = await pool.query(
  `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE $1 ...`,
  [`%${q}%`, limit, offset]
);
```

The documentation in `src/routes.ts` preserves the educational comment about the original bug, even though the code is fixed.

### 5. Soft Delete Implementation

```typescript
router.delete('/notes/:id', async (req: Request, res: Response) => {
  await pool.query('UPDATE notes SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
  res.status(204).send();
});
```

Every query includes `deleted_at IS NULL`. Deleted notes are excluded from search, lists, and individual gets.

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Search | None | ILIKE (parameterized) |
| SQL injection | String concat | ✓ Parameterized queries |
| Pagination | None | Page + limit + total count |
| Soft delete | Hard delete | `deleted_at` timestamp |
| Database | None | PostgreSQL with connection pool |
| Types | None | TypeScript |
| Tests | None | Vitest (CRUD + search + injection) |
| Module system | CommonJS | ESM |

## The Realization

> Junior: "I added parameterized queries and saw the ILIKE search get slow at 10,000 notes. The test suite still passes, but performance tests would fail. That's the next evolution — tsvector."
> 
> You: "Search is a journey, not a destination. ILIKE works for 1,000 rows. Full-text search works for 1,000,000. Elasticsearch works for 1,000,000,000. Each step requires schema changes, new indexes, and new query syntax. Start simple, measure, evolve."

## Files in this project

```
S05-note-api/
├── src/
│   ├── index.ts          # Entry point + server export
│   ├── routes.ts         # CRUD + search + pagination + soft delete
│   └── db.ts             # PostgreSQL pool + init
├── tests/
│   └── notes.test.ts     # Vitest (CRUD + search + soft delete)
├── docker-compose.yml    # PostgreSQL for local dev
├── package.json          # ESM
└── tsconfig.json
```

## What You Learned

1. **Search evolution**: No search → client-side → SQL LIKE → full-text search → tsvector ranking. Each step solves the previous step's scaling limit.
2. **Parameterized queries are mandatory**: `ILIKE $1` instead of `ILIKE '%${q}%'`. No exceptions.
3. **Soft delete > hard delete**: Users accidentally delete. Auditors ask "what happened?" `deleted_at` answers both.
4. **Pagination is required**: `SELECT *` is a denial-of-service attack against yourself.
5. **Indexes matter**: `ILIKE '%term%'` can't use indexes. `tsvector` can. When you hit performance walls, schema evolution is the answer.
