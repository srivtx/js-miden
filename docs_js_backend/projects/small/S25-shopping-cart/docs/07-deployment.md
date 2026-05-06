# 07-deployment.md

## Docker

```bash
docker-compose up --build
```

## Production Considerations

- Replace in-memory Map with Redis (already configured)
- Set Redis key expiration (`EXPIRE cart:<id> <seconds>`)
- Use signed cookies for cart ID transport
- HTTPS-only cookies to prevent session hijacking
- Encrypt cart contents at rest if sensitive

## Scaling

- Redis Cluster for session distribution
- Sticky sessions or shared Redis for horizontal scaling
- Cart abandonment analytics pipeline
- Periodic cleanup jobs for expired sessions
