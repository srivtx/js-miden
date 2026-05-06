# S05 Note API — Key Concepts

## 1. Full-Text Search Strategies

### ILIKE (used here, dangerously)
```sql
SELECT * FROM notes WHERE content ILIKE '%search_term%'
```

- **Pros**: Simple, no extensions needed, handles partial matches.
- **Cons**: No index can help (leading wildcard); scans entire table. O(n) per query.

### tsvector + tsquery (PostgreSQL native)
```sql
ALTER TABLE notes ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED;
CREATE INDEX idx_notes_search ON notes USING GIN (search_vector);

SELECT * FROM notes
WHERE search_vector @@ to_tsquery('english', 'postgresql & tutorial');
```

- **Pros**: Very fast, linguistically aware (stemming: "run" matches "running"), ranked results.
- **Cons**: No substring matching (`'post'` does not match `'postgresql'`); requires rebuilding vectors on schema changes.

### pg_trgm (trigram similarity)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_notes_trgm ON notes USING GIN (content gin_trgm_ops);

SELECT * FROM notes WHERE content % 'search_term';
```

- **Pros**: Fuzzy matching, typo tolerance (`'teh'` ≈ `'the'`), substring support.
- **Cons**: Slower than tsvector for exact phrase matching; higher index size.

**Why these patterns exist**: Different search problems demand different tools.
- **Exact phrase matching** → tsvector
- **Fuzzy/autocomplete** → pg_trgm
- **Simple filtering with low data** → ILIKE
- **Best of both** → Combine tsvector for primary search + pg_trgm for autocomplete.

## 2. Pagination Strategies

### Offset (used here)
```sql
SELECT * FROM notes ORDER BY id LIMIT 10 OFFSET 20;
```

- **Pros**: Simple, stateless, easy to jump to page 47.
- **Cons**: Gets slower as offset grows (must scan and discard N rows). Inconsistent results if data changes between page loads.

### Cursor (keyset)
```sql
SELECT * FROM notes WHERE id > $cursor ORDER BY id LIMIT 10;
```

- **Pros**: O(1) performance regardless of depth; consistent snapshot.
- **Cons**: Cannot jump to arbitrary page; requires a stable sort key.

**Performance comparison** on 1 million rows:

| Page | Offset Latency | Cursor Latency |
|------|----------------|----------------|
| 1 | 0.5 ms | 0.5 ms |
| 100 | 12 ms | 0.6 ms |
| 10,000 | 890 ms | 0.7 ms |

**Why offset is still popular**: It is trivial to implement and sufficient for <10,000 rows. Cursor pagination is mandatory for infinite-scroll UIs with large datasets.

## 3. Soft Delete Patterns

Instead of `DELETE FROM notes WHERE id = 1`:
```sql
UPDATE notes SET deleted_at = NOW() WHERE id = 1;
```

**Why it exists**:
- Accidental deletion recovery
- Audit trails and compliance
- Referential integrity (other tables may reference this row historically)

**Trade-offs**:
- Every query must include `WHERE deleted_at IS NULL`.
- Indexes must include `deleted_at` to remain efficient.
- Storage grows forever unless you run a hard-delete purge job.

**Alternatives**:
- **Hard delete + audit log**: Move row to `deleted_notes` table. Keeps primary table clean.
- **Paranoid gem pattern (Rails)**: Same as soft delete, but framework auto-filters.

## 4. Indexing

### B-Tree (default)
```sql
CREATE INDEX idx_notes_created_at ON notes (created_at);
```
- Best for: equality, range, sorting.
- Used by: `=`, `<`, `>`, `BETWEEN`, `ORDER BY`.

### GIN (Generalized Inverted Index)
```sql
CREATE INDEX idx_notes_tsvector ON notes USING GIN (search_vector);
```
- Best for: full-text search, JSONB containment, array membership.
- Slower to write than B-Tree; faster for complex queries.

### GiST (Generalized Search Tree)
```sql
CREATE INDEX idx_notes_trgm ON notes USING GiST (content gist_trgm_ops);
```
- Best for: trigram similarity, geometric data.
- GiST is lossy (may return false positives filtered by recheck).

### BRIN (Block Range Index)
```sql
CREATE INDEX idx_notes_time_brin ON notes USING BRIN (created_at);
```
- Best for: very large, naturally ordered tables (time-series).
- Tiny index size (KB vs MB), but only useful for range queries on correlated data.

**Why index choice matters**: The wrong index type is worse than no index — it slows writes and wastes space while the query planner ignores it.
