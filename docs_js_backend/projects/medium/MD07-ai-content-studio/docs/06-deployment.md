# Deployment

## Docker

```bash
docker compose up -d
```

## Environment Variables

| Variable            | Default      | Description                  |
|---------------------|--------------|------------------------------|
| DB_HOST             | localhost    | PostgreSQL host              |
| DB_PORT             | 5434         | PostgreSQL port              |
| DB_USER             | ai           | Database user                |
| DB_PASSWORD         | aipass       | Database password            |
| DB_NAME             | aidb         | Database name                |
| OPENAI_API_KEY      | (required)   | OpenAI API key               |
| HOURLY_TOKEN_LIMIT  | 100000       | Max tokens per hour          |
| PORT                | 3000         | API port                     |

## Production Checklist

- [ ] Rotate OpenAI API keys regularly
- [ ] Enable request authentication (API keys / JWT)
- [ ] Monitor token usage and costs per user
- [ ] Add Redis cache for frequent prompts
- [ ] Use pgvector with appropriate `m` and `ef_construction` for HNSW
