# Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │◀───▶│ Express API  │◀───▶│ PostgreSQL  │
│  (SSE)      │     │  (OpenAI)    │     │  (pgvector) │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Flow: Generate

1. Client sends `POST /api/generate` with prompt
2. **Moderation** middleware checks for prompt injection patterns
3. **Rate limit** checks hourly token usage against `HOURLY_TOKEN_LIMIT`
4. **Stream** LLM response via SSE with 30-second timeout
5. **Store** completed prompt + response in database for semantic search

## Flow: Search

1. Client sends `POST /api/search` with query text
2. Server queries PostgreSQL `pg_trgm` similarity (or pgvector cosine similarity)
3. Returns most similar past content ranked by score

## Token Counting

Approximate token counting is used in the stream loop. For production, use `tiktoken` or the OpenAI tokenizer for precise counts.

## Caching

Prompts and responses are cached in the database. Future identical prompts could hit cache before calling the LLM (Phase 3 enhancement).
