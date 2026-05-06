# Deployment

## Docker Compose

```bash
docker-compose up -d
```

This starts:
- Order Service (port 3011)
- Trade Service (port 3012)
- Market Data Service (port 3013)
- PostgreSQL (port 5411)
- Redis (port 6311)

## Production Considerations

- Use connection pooling for PostgreSQL
- Redis for order book caching
- WebSocket for real-time market data
- Rate limiting on order placement

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgres://... | PostgreSQL connection |
| REDIS_URL | redis://... | Redis connection |
| JWT_SECRET | dev-secret | Auth secret |
| PORT | 3000 | Service port |
