# S05 Note API — Decision Log

## Decision: ILIKE vs tsvector vs pg_trgm

| Approach | Speed (1M rows) | Substrings | Fuzzy | Setup |
|----------|-----------------|------------|-------|-------|
| ILIKE | 850 ms | Yes | No | None |
| tsvector | 2 ms | No | No | Extension + generated column |
| pg_trgm | 15 ms | Yes | Yes | Extension + GIN index |
| tsvector + pg_trgm | 4 ms | Yes | Yes | Both extensions |

We chose ILIKE for simplicity in a demo project. In production:
1. Use `tsvector` for the main search box (fast, ranked).
2. Use `pg_trgm` for autocomplete/typeahead.
3. Never use bare ILIKE on user-facing search beyond ~1,000 rows.

## Decision: Offset vs Cursor Pagination

| Approach | UX | Performance | Implementation |
|----------|-----|-------------|----------------|
| Offset | Page numbers | Degrades with depth | Trivial |
| Cursor | Infinite scroll | Constant time | Requires stable key |
| Seek (cursor + total) | Hybrid | Good | Complex |

We chose offset because:
1. It is the default mental model for developers.
2. It allows jumping to any page.
3. For a note app with <10K notes per user, the performance difference is imperceptible.

**When to switch to cursor**: When any user has >50,000 notes, or when you implement infinite scroll.

## Decision: Soft Delete vs Hard Delete + Audit Log

| Approach | Query Complexity | Recovery | Storage | Audit |
|----------|------------------|----------|---------|-------|
| Soft delete | High (always filter) | Instant | Grows forever | Built-in |
| Hard delete + audit table | Low | Restore from audit | Controlled | Explicit |
| Temporal tables (SQL Server) | Low | Time-travel query | Grows forever | Built-in |

We chose soft delete because:
1. It is the most common pattern in ORMs (Prisma, Sequelize, TypeORM).
2. It requires no additional tables.
3. Recovery is a single `UPDATE`.

**Downside**: Every query forgetting `deleted_at IS NULL` leaks deleted data. Linters and database views help enforce this.

## Decision: No Input Validation Library

Current code validates only presence:
```ts
if (!title || !content) { res.status(400)... }
```

There is no length limit, no XSS sanitization, and no SQL injection protection in the search path.

| Approach | Validation | Sanitization | Schema |
|----------|------------|--------------|--------|
| Manual (current) | Minimal | None | Ad-hoc |
| Zod | Excellent | Type-safe | Declarative |
| Joi | Excellent | Built-in | Declarative |
| Yup | Good | Partial | Declarative |

We should add Zod:
```ts
const NoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
});
```

## Decision: Raw SQL vs Query Builder vs ORM

| Approach | Control | Safety | Productivity |
|----------|---------|--------|--------------|
| Raw SQL (current) | Full | Low (injection risk) | High for simple queries |
| Query builder (Knex) | High | Medium | High |
| ORM (Prisma/TypeORM) | Medium | High | Very high |

Raw SQL is acceptable for a demo but dangerous at scale. The search route's string concatenation is a textbook injection vulnerability.

## Decision: PostgreSQL vs SQLite vs MongoDB

| Database | Full-Text Search | ACID | Scaling | Best For |
|----------|------------------|------|---------|----------|
| PostgreSQL | Excellent (tsvector, trigram) | Yes | Vertical + read replicas | Relational data with search |
| SQLite | Limited (FTS5) | Yes | Single file | Mobile, embedded |
| MongoDB | Good (text index) | Eventually | Horizontal | Document-heavy, flexible schema |
| Elasticsearch | Best | No (eventually) | Horizontal | Dedicated search |

We chose PostgreSQL because:
1. It has industry-leading full-text search built in.
2. It is the default choice for Node.js relational apps.
3. It avoids the operational complexity of Elasticsearch for a small project.
