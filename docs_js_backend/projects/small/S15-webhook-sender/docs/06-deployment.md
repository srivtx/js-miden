# Deployment

## Docker

```bash
docker compose up -d
```

## Environment Variables

| Variable   | Default       | Description         |
|------------|---------------|---------------------|
| DB_HOST    | localhost     | PostgreSQL host     |
| DB_PORT    | 5433          | PostgreSQL port     |
| DB_USER    | webhook       | Database user       |
| DB_PASSWORD| webhookpass   | Database password   |
| DB_NAME    | webhookdb     | Database name       |
| PORT       | 3000          | API port            |

## Production Checklist

- [ ] Add request signing with strong secrets (min 256-bit)
- [ ] Implement circuit breaker to avoid overwhelming failing receivers
- [ ] Use HTTPS only for webhook URLs
- [ ] Monitor delivery success rate and retry queues
- [ ] Add webhook URL validation (DNS resolution, IP blocklists)
