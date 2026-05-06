# Database Schema

## contents

| Column        | Type       | Description                          |
|---------------|------------|--------------------------------------|
| id            | SERIAL PK  | Content ID                           |
| prompt        | TEXT       | User prompt                          |
| response      | TEXT       | AI response                          |
| embedding     | vector(1536)| OpenAI embedding vector              |
| tokens_used   | INTEGER    | Approximate tokens consumed          |
| moderated     | BOOLEAN    | Passed moderation check              |
| created_at    | TIMESTAMP  | Creation time                        |

## Indexes

```sql
CREATE INDEX idx_contents_embedding ON contents USING hnsw (embedding vector_cosine_ops);
```

**Note:** HNSW index enables fast approximate nearest neighbor search. For exact search or smaller datasets, `ivfflat` may be sufficient.

## Extensions

```sql
CREATE EXTENSION vector;
CREATE EXTENSION pg_trgm; -- For text similarity fallback
```
