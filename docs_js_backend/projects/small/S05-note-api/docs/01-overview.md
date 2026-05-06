# S05 Note API — Overview

## Project Goal
Build a REST API for managing text notes with full-text search, pagination, and soft deletes.

## Architecture
```
Client → Express Router
         ├── POST   /notes        → INSERT
         ├── GET    /notes        → SELECT + search + pagination
         ├── GET    /notes/:id    → SELECT by PK
         ├── PUT    /notes/:id    → UPDATE
         └── DELETE /notes/:id    → Soft delete (UPDATE deleted_at)
```

## Tech Stack
- **Runtime**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (`pg` driver)
- **Testing**: Vitest + Supertest
- **Infra**: Docker Compose for local Postgres

## What This Project Demonstrates
1. Soft delete patterns
2. Full-text search strategies (ILIKE vs tsvector vs trigram)
3. Pagination (offset vs cursor)
4. SQL injection vulnerability (intentional bug)
5. Indexing trade-offs

## Quick Start
```bash
npm run db:up   # Start Postgres via Docker Compose
npm run dev
```

## File Map
| File | Responsibility |
|------|----------------|
| `src/routes.ts` | All CRUD + search endpoints |
| `src/db.ts` | Pool configuration, schema init |
| `src/index.ts` | Server bootstrap |
| `tests/notes.test.ts` | Integration tests |
| `docker-compose.yml` | Local Postgres service |

## Production Checklist
- [ ] Fix SQL injection by using parameterized queries for search
- [ ] Add database indexes for search and pagination
- [ ] Implement cursor pagination for large datasets
- [ ] Add tsvector or pg_trgm for efficient search
- [ ] Add request validation (Zod/Joi)
