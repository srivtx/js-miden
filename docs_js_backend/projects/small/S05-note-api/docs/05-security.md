# S05 Note API — Security

## Intentional Bug: SQL Injection in Search

**Location**: `src/routes.ts`, lines 29-35

```ts
rows = await pool.query(
  `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE '%${q}%' ORDER BY id LIMIT ${limit} OFFSET ${offset}`
);
countResult = await pool.query(
  `SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL AND content ILIKE '%${q}%'`
);
```

### Real-World Consequence
An attacker sends:
```
GET /notes?q='; DROP TABLE notes; --
```

The query becomes:
```sql
SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE '%'; DROP TABLE notes; --%' ORDER BY id LIMIT ...
```

In PostgreSQL, `pool.query()` sends the entire string as a single command. If the driver allowed multiple statements (some drivers do with certain flags), the table is destroyed. Even without multi-statement support:

```
GET /notes?q=' UNION SELECT * FROM users --
```
This extracts data from other tables via UNION injection.

### Fix
Use parameterized queries. Unfortunately, ILIKE with a leading wildcard cannot use a simple `$1` parameter inside the pattern. The correct approach:

```ts
const pattern = `%${q}%`; // Still sanitize/validate q first!
rows = await pool.query(
  `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
  [pattern, limit, offset]
);
```

Even better: switch to tsvector or pg_trgm and use safe parameters.

## Missing Input Validation

`title` and `content` are not length-limited or sanitized. Consequences:
- **Storage abuse**: A 100 MB content field fills disk.
- **XSS**: If this API feeds a frontend that renders raw HTML, `<script>alert(1)</script>` executes.
- **Log injection**: Newlines in content create fake log entries.

**Fix**:
```ts
const MAX_TITLE = 200;
const MAX_CONTENT = 100_000;
if (title.length > MAX_TITLE) return res.status(400).json({ error: 'Title too long' });
```

## Soft Delete Data Leakage

If any query forgets `deleted_at IS NULL`, deleted notes are visible. The `GET /notes/:id` route correctly filters, but a future developer might add:
```ts
pool.query('SELECT * FROM notes WHERE title = $1', [title]);
```

**Mitigation**:
1. Use a database view: `CREATE VIEW active_notes AS SELECT * FROM notes WHERE deleted_at IS NULL;`
2. Use an ORM with soft-delete built in.
3. Code review every new query.

## Injection in Pagination Parameters

`limit` and `offset` are parsed with `parseInt`, but the fallback path uses string interpolation:
```ts
const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
```

This is actually safe because `Math.min/max` coerce to number. However, if someone refactors and removes `Math.min`, `limit` could become a string injection vector.

## Mass Assignment

`POST /notes` accepts any JSON body:
```ts
const { title, content } = req.body;
```

If the table later adds `is_admin` or `user_id`, an attacker can send:
```json
{ "title": "x", "content": "y", "user_id": 1 }
```

If the query uses spread or dynamic column lists, this overwrites data.

**Fix**: Use allow-list validation:
```ts
const allowed = { title: req.body.title, content: req.body.content };
```

## Connection String Exposure

Current `src/db.ts` hardcodes credentials with fallbacks:
```ts
password: process.env.PGPASSWORD || 'notes',
```

If the environment variable is missing, the default password is used. This is convenient for demos but dangerous if deployed to staging/production without overriding.

**Fix**: Remove fallbacks for sensitive values and fail fast on startup:
```ts
if (!process.env.PGPASSWORD) throw new Error('PGPASSWORD required');
```
