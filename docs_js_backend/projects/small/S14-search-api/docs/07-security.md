# Security

## SQL Injection Prevention

The correct `/search` endpoint uses parameterized queries with `plainto_tsquery`:

```sql
WHERE search_vector @@ plainto_tsquery('english', $1)
```

**Never** concatenate user input:

```sql
-- VULNERABLE:
WHERE search_vector @@ to_tsquery('english', '${userInput}')
```

## Input Validation

- `q` parameter is trimmed and checked for emptiness
- `page` and `limit` are parsed as integers with bounds checking

## Index Security

GIN indexes on `tsvector` columns do not expose raw content. However, document content is still stored in plain text in `title` and `content` columns. Apply row-level security if needed.
