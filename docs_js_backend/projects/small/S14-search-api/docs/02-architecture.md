# Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│ Express API  │────▶│ PostgreSQL  │
│             │◀────│  (tsvector)  │◀────│   (GIN)     │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Flow

1. **Indexing**: Client sends `POST /api/index` with title and content
2. **Vectorization**: Server computes `to_tsvector('english', title || ' ' || content)`
3. **Storage**: Document stored with precomputed tsvector in GIN-indexed column
4. **Search**: Client sends `GET /api/search?q=query`
5. **Query Parsing**: Server converts query to `plainto_tsquery('english', $1)`
6. **Matching**: `WHERE search_vector @@ plainto_tsquery(...)` filters rows
7. **Ranking**: `ts_rank_cd` orders by relevance
8. **Highlighting**: `ts_headline` extracts matching fragments

## Stemming

PostgreSQL's English text search dictionary reduces words to stems:
- "running" → "run"
- "runs" → "run"
- "runner" → "run"

This allows searching "run" to match all variations.
