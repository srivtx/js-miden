# Deployment

## Docker Compose

```bash
docker-compose up -d
```

Services:
- `app`: Node.js gateway (port 3010)
- `postgres`: PostgreSQL (port 5440)
- `redis`: Redis (port 6380)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://... | PostgreSQL connection |
| REDIS_URL | redis://... | Redis connection |
| JWT_SECRET | dev-secret | JWT signing key |
| PORT | 3000 | Server port |

## Production Considerations

1. **RLS Enforcement**: Ensure RLS is enabled on all tenant tables
2. **API Key Rotation**: Support key rotation without downtime
3. **Usage Aggregation**: Batch usage records to reduce DB writes
4. **GDPR**: Automated data deletion per tenant request

## Multi-Region

- Gateway in each region
- Regional PostgreSQL read replicas
- Central write master
- Tenant data residency rules
