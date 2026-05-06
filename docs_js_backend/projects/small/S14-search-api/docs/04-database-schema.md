# Database Schema

## documents

| Column        | Type       | Description                          |
|---------------|------------|--------------------------------------|
| id            | SERIAL PK  | Document ID                          |
| title         | TEXT       | Document title                       |
| content       | TEXT       | Document content                     |
| search_vector | tsvector   | Precomputed search vector            |
| created_at    | TIMESTAMP  | Creation time                        |

## Indexes

```sql
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);
CREATE INDEX idx_documents_content ON documents(content);
```

**Note:** The `idx_documents_content` index is a B-tree index on plain text. Without `idx_documents_search`, full-text search falls back to sequential scans or slower B-tree lookups, demonstrating the "no index on search column" bug scenario.
