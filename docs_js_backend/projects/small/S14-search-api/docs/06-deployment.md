# Deployment

## Docker

```bash
docker compose up -d
```

## Environment Variables

| Variable   | Default      | Description       |
|------------|--------------|-------------------|
| DB_HOST    | localhost    | PostgreSQL host   |
| DB_PORT    | 5432         | PostgreSQL port   |
| DB_USER    | search       | Database user     |
| DB_PASSWORD| searchpass   | Database password |
| DB_NAME    | searchdb     | Database name     |
| PORT       | 3000         | API port          |

## Production Checklist

- [ ] Enable PostgreSQL connection pooling (PgBouncer)
- [ ] Add rate limiting on search endpoints
- [ ] Monitor GIN index bloat
- [ ] Consider read replicas for search-heavy workloads
