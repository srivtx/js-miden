# S05 Note API — Error Handling

## Database Errors

| Error Code | Meaning | Response |
|------------|---------|----------|
| `28P01` | Invalid password | 500 (log, do not leak auth details) |
| `3D000` | Database does not exist | 500 |
| `42P01` | Undefined table | 500 (schema not initialized) |
| `23505` | Unique violation | 409 Conflict |
| `22001` | Value too long | 400 |

Current code does not catch database errors. An unhandled rejection crashes the Node.js process.

## Global Error Handler

Add to `src/index.ts`:
```ts
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  res.status(500).json({ error: 'Internal server error' });
});
```

## Not Found Handling

`GET /notes/:id` returns 404 correctly. However, `PUT /notes/:id` and `DELETE /notes/:id` do not verify existence before updating:

```ts
// PUT returns empty result set → 404 (handled)
// DELETE returns 204 even if row did not exist
```

A `DELETE` on a non-existent ID returns 204, which is idempotent and REST-acceptable, but ambiguous. Some APIs prefer:
```ts
const result = await pool.query('UPDATE notes SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [id]);
if (result.rowCount === 0) return res.status(404).json({ error: 'Not found or already deleted' });
res.status(204).send();
```

## Transaction Safety

Current code uses autocommit (every query is its own transaction). For multi-step operations, use explicit transactions:

```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO notes ...', [title, content]);
  await client.query('INSERT INTO audit_log ...', [userId, 'create']);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

## Graceful Shutdown

On `SIGTERM`:
1. Stop accepting HTTP requests.
2. Drain the PostgreSQL pool (`pool.end()`).
3. Exit process.

This prevents in-flight queries from being aborted mid-execution.

## Structured Logging

```json
{
  "level": "error",
  "msg": "database_query_failed",
  "query": "SELECT * FROM notes WHERE id = $1",
  "error": "connection terminated unexpectedly",
  "duration_ms": 45
}
```

Never log query parameters that contain PII (note content) at `info` level. Use `debug` or redaction.
