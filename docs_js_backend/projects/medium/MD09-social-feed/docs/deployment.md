# Deployment

## Docker Compose

```bash
docker-compose up -d
```

Services:
- `app`: Node.js API server (port 3009)
- `postgres`: PostgreSQL (port 5439)
- `redis`: Redis cache (port 6379)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://... | PostgreSQL connection |
| REDIS_URL | redis://... | Redis connection |
| JWT_SECRET | dev-secret | JWT signing key |
| PORT | 3000 | Server port |

## Production Considerations

1. **Fan-out Workers**: Use Redis Streams or RabbitMQ for async fan-out
2. **Read Replicas**: PostgreSQL read replicas for feed queries
3. **CDN**: Static assets and user avatars
4. **Monitoring**: Redis memory usage, feed latency

## Scaling

### Horizontal Scaling
- Stateless API servers behind load balancer
- Shared Redis cluster for feeds
- PostgreSQL with read replicas

### Feed Sharding
- Shard user feeds across multiple Redis instances
- Hash userId to determine shard
