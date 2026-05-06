# S05 Note API — Production Guide

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PGHOST` | `localhost` | Database host |
| `PGPORT` | `5432` | Database port |
| `PGUSER` | `notes` | Database user |
| `PGPASSWORD` | `notes` | Database password |
| `PGDATABASE` | `notesdb` | Database name |
| `PORT` | `3000` | HTTP port |

**Remove defaults for `PGPASSWORD` in production.**

## PostgreSQL Configuration

```conf
# postgresql.conf
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 8MB
maintenance_work_mem = 128MB
```

For a write-heavy note API, also tune:
```conf
wal_buffers = 16MB
random_page_cost = 1.1  # If using SSD
```

## Index Checklist

Before going live, run:
```sql
-- Primary key (already exists)
-- Soft-delete filter
CREATE INDEX idx_notes_active ON notes (id) WHERE deleted_at IS NULL;

-- Search (choose one)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_notes_content_trgm ON notes USING GIN (content gin_trgm_ops);

-- Or tsvector
ALTER TABLE notes ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED;
CREATE INDEX idx_notes_search ON notes USING GIN (search_vector);

-- Pagination
CREATE INDEX idx_notes_created_sort ON notes (created_at DESC, id DESC);
```

## Connection Pooling

Add PgBouncer in transaction mode for high concurrency:

```
App → PgBouncer (transaction pool) → PostgreSQL
```

Without PgBouncer, each Node.js worker holds 10 connections. At 20 workers, that's 200 connections — exactly `max_connections`.

## Backup Strategy

| Method | RPO | Complexity | Best For |
|--------|-----|------------|----------|
| `pg_dump` | Hours | Low | Small databases (<10 GB) |
| WAL archiving + PITR | Minutes | Medium | Production |
| Logical replication | Seconds | High | High availability |

For a note API, daily `pg_dump` plus continuous WAL archiving to S3 is sufficient.

## Monitoring

| Metric | Query/Tool | Alert |
|--------|-----------|-------|
| Slow queries | `pg_stat_statements` | >100 ms p99 |
| Connection usage | `pg_stat_activity` | >80% of max |
| Index bloat | `pgstattuple` extension | >30% bloat |
| Replication lag | `pg_stat_replication` | >5 seconds |

## Scaling

- **Read replicas**: Offload `GET` traffic. Route writes to primary.
- **Sharding**: Split by `user_id` range when single-node PostgreSQL saturates.
- **Elasticsearch**: If search becomes the bottleneck, sync notes to Elasticsearch and query there.

## Incident Response

**Slow search detected**
1. Run `EXPLAIN ANALYZE` on the slow query.
2. Verify `deleted_at IS NULL` is using the partial index.
3. If ILIKE is still in use, emergency-switch to `pg_trgm` or `tsvector`.
4. Add query timeout: `SET statement_timeout = '5s'`.
