# S05 Note Taking API

## Concepts
- CRUD with PostgreSQL
- Full-text search (ILIKE vs tsvector)
- Pagination strategies
- Soft delete pattern

## Phase 1
- `POST /notes` create
- `GET /notes?q=keyword&page=1&limit=10` list + search
- `GET /notes/:id` read
- `PUT /notes/:id` update
- `DELETE /notes/:id` soft delete

## Phase 2-3 Thinking Framework
1. **SQL Injection**: Never concatenate user input into SQL. Use parameterized queries (`$1`, `$2`).
2. **Full-Text Search**: `ILIKE '%word%'` cannot use indexes and is slow. Prefer `tsvector` + `tsquery` with a GIN index.
3. **Pagination**: `OFFSET` scales poorly because the DB still scans all prior rows. Prefer **keyset pagination** (`WHERE id > $cursor ORDER BY id LIMIT n`).
4. **Soft Delete**: Add `deleted_at` column. Always filter `WHERE deleted_at IS NULL`. Consider a partial index `(deleted_at) WHERE deleted_at IS NULL` to speed up active-record queries.
5. **Indexes**: At minimum index `created_at` and search columns. For ILIKE, a `pg_trgm` GIN index helps.

## Bug
- **SQL Injection**: The search route interpolates `q` directly into the SQL string:
  ```sql
  SELECT * FROM notes WHERE content ILIKE '%${q}%'
  ```
  An attacker can inject via `q='; DROP TABLE notes; --`.
- **OFFSET pagination**: The list route uses `OFFSET` which degrades on large tables.
- **Missing index**: No index exists on `content` or `title`, causing full table scans.

## Run
```bash
docker compose up -d
npm install
npm run dev
```

## Test
```bash
npm test
```
