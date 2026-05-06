# MD07: AI Content Studio

AI writing assistant with SSE streaming, semantic search, content moderation, and token rate limiting.

## Features

- **Phase 1**: `POST /generate` streams LLM responses via SSE, `POST /search` semantic search, moderation
- **Phase 2-3**: Token counting, embedding generation, vector search (pgvector), prompt caching
- **Intentional Bugs**:
  - `streamCompletionNoTimeout` hangs forever without timeout
  - `noModeration` middleware bypasses content filtering
  - Missing rate limit by tokens (documented in comparison)

## Quick Start

```bash
cp .env.example .env
# Add OPENAI_API_KEY to .env
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
  index.ts              # Entry point
  app.ts                # Express app setup
  db.ts                 # PostgreSQL + pgvector setup
  routes/
    content.ts          # Generate & search routes
  services/
    llm.ts              # OpenAI streaming wrapper
  middleware/
    moderation.ts       # Prompt injection guard
  types.ts              # Shared types
tests/
  content.test.ts       # Vitest + Supertest suite
docs/
  01-overview.md
  ...
```
