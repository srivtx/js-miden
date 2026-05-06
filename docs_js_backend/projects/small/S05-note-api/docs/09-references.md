# S05 Note API — References

## PostgreSQL Documentation

1. **PostgreSQL — Full-Text Search**
   https://www.postgresql.org/docs/current/textsearch.html
   > Official guide to tsvector, tsquery, ranking, and dictionaries.

2. **PostgreSQL — pg_trgm Extension**
   https://www.postgresql.org/docs/current/pgtrgm.html
   > Trigram similarity operators, GIN/GiST index support, and performance notes.

3. **PostgreSQL — Indexes Types**
   https://www.postgresql.org/docs/current/indexes-types.html
   > B-Tree, Hash, GiST, SP-GiST, GIN, and BRIN index characteristics.

4. **PostgreSQL — Performance Tips**
   https://www.postgresql.org/docs/current/performance-tips.html
   > Shared buffers, work_mem, and planner configuration.

## SQL Injection

5. **OWASP — SQL Injection**
   https://owasp.org/www-community/attacks/SQL_Injection
   > How injection works, exploitation techniques, and prevention.

6. **Bobby Tables — PostgreSQL Parameterized Queries**
   https://bobby-tables.com/postgresql
   > Practical examples of safe query construction in Node.js with `pg`.

## Pagination

7. **Markus Winand — OFFSET is Bad for Pagination**
   https://use-the-index-luke.com/no-offset
   > Detailed explanation of why offset pagination degrades and how keyset pagination solves it.

8. **Slack Engineering — Building a Faster Slack**
   https://slack.engineering/building-a-faster-slack/
   > How Slack migrated from offset to cursor pagination for channel history.

## Node.js & PostgreSQL

9. **node-postgres Documentation**
   https://node-postgres.com/
   > Pool configuration, parameterized queries, and error handling.

10. **Vitest Documentation**
    https://vitest.dev/
    > Testing framework used in the project.

## Soft Deletes

11. **Paranoid vs Hard Delete — Prisma Blog**
    https://www.prisma.io/blog/fullstack-prisma-nextjs-1-Xi80U3DZ1l3o
    > Discussion of soft delete patterns and their trade-offs in modern ORMs.

12. **Martin Fowler — Temporal Patterns**
    https://martinfowler.com/eaaDev/timeNarrative.html
    > Design patterns for tracking historical data and deletion auditing.
