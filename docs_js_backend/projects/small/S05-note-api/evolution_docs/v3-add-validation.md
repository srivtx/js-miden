# v3 — Add Validation (Note API)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they say. Then a user searches with `q='; DROP TABLE notes; --` and your SQL becomes:

```sql
SELECT * FROM notes WHERE content ILIKE '%'; DROP TABLE notes; --%'
```

Your notes table is gone. TypeScript approved — it's a valid string.

## The PAIN: SQL Injection Lives in Valid Strings

From v2:

```typescript
router.get('/notes', async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  if (q) {
    // TypeScript sees: q is string | undefined
    // Runtime sees: q is "'; DROP TABLE notes; --"
    rows = await pool.query(
      `SELECT * FROM notes WHERE content ILIKE '%${q}%' ORDER BY id LIMIT ${limit} OFFSET ${offset}`
    );
  }
});
```

This is the most dangerous bug in web development. It compiles. It runs. It destroys data. And TypeScript can't stop it because **the input type is correct**.

### Real injection payloads:

```
q='; DROP TABLE notes; --
q=' UNION SELECT username, password FROM users --
q=' OR '1'='1
```

All are valid strings. All are catastrophic.

## The Solution: Parameterized Queries + Input Validation

### Fix 1: Never Concatenate SQL

```typescript
// WRONG:
`SELECT * FROM notes WHERE content ILIKE '%${q}%'`

// RIGHT:
`SELECT * FROM notes WHERE content ILIKE $1 AND deleted_at IS NULL ORDER BY id LIMIT $2 OFFSET $3`

// Parameters passed separately:
[`%${q}%`, limit, offset]
```

```typescript
router.get('/notes', async (req: Request, res: Response) => {
  const parseResult = listQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid query parameters' });
    return;
  }
  
  const { q, page, limit } = parseResult.data;
  const offset = (page - 1) * limit;
  
  let rows;
  let countResult;
  
  if (q) {
    rows = await pool.query(
      `SELECT * FROM notes 
       WHERE deleted_at IS NULL AND content ILIKE $1 
       ORDER BY id LIMIT $2 OFFSET $3`,
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
    countResult = await pool.query(
      `SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL`
    );
  }
  
  res.json({
    data: rows.rows,
    pagination: { page, limit, total: parseInt(countResult.rows[0].count, 10) },
  });
});
```

### Fix 2: Validate Search Input

```typescript
const listQuerySchema = z.object({
  q: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

### What validation catches:

| Input | Before (concatenation) | After (parameterized + validated) |
|-------|----------------------|-----------------------------------|
| `q='; DROP TABLE` | **SQL injection, data loss** | Treated as literal string, safe |
| `q=' UNION SELECT...` | **Data exfiltration** | Treated as literal string, safe |
| `q='` (empty) | Returns all notes (unintended) | **Rejected**: Min 1 char |
| `q=a... (10KB)` | Slow query, log bloat | **Rejected**: Max 200 chars |
| `page=abc` | `NaN` in SQL | **Rejected**: Expected number |

## The PAIN of Client-Side Search

Some developers think: "I'll just fetch all notes and search client-side!"

```typescript
// WRONG:
const allNotes = await pool.query('SELECT * FROM notes');
const filtered = allNotes.rows.filter(n => n.content.includes(q));
```

Problems:
- 10,000 notes fetched for a single search → memory + bandwidth waste
- Pagination becomes impossible
- Database indexes unused

Server-side search with proper SQL is the only scalable approach.

## Validation Evolution in Note API

| Version | Search approach | Security |
|---------|----------------|----------|
| v1 (JS) | String concatenation | ❌ SQL injection |
| v2 (TS) | Still concatenation | ❌ SQL injection (types don't help) |
| v3 (Zod + parameterized) | Safe parameterized queries | ✓ Injection impossible |

## The Realization

> Junior: "Parameterized queries feel weird at first. But now I see: the database NEVER interprets user input as SQL. It's always just a value."
> 
> You: "Exactly. SQL injection isn't a user problem — it's a developer problem. The fix is a habit, not a library. Parameterize every query. Every time. No exceptions."

## The Next PAIN

SQL injection is plugged, but your search is just `ILIKE '%term%'`. It finds nothing for partial words, has no relevance ranking, and gets slower as notes grow. A user searches for "database design" and gets notes about "design patterns" before notes with the exact phrase.

## Next: v4 — Add Logging
