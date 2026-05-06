# S14: Search API

Full-text search API over documents using PostgreSQL `tsvector`.

## Features

- **Phase 1**: Index documents via `POST /index`, search via `GET /search?q=query`
- **Phase 2-3**: Stemming, ranking algorithms, pagination, highlighting
- **Intentional Bugs**:
  - `/search-slow` uses `ILIKE` instead of `tsvector`
  - `/search-unsafe` demonstrates SQL injection via raw concatenation

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:up
npm run dev
```

## Testing

```bash
npm test
```

## Project Structure

```
src/
  index.ts       # Entry point
  app.ts         # Express app setup
  db.ts          # PostgreSQL connection & migrations
  routes/
    search.ts    # Search & index routes
  types.ts       # Shared types
tests/
  search.test.ts # Vitest + Supertest suite
docs/
  01-overview.md
  ...
```
