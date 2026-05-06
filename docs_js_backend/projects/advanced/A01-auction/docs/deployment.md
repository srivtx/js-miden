# Deployment

## Docker Compose

```bash
docker-compose up -d
```

Services:
- `app`: Node.js auction server (port 3001)
- `postgres`: PostgreSQL (port 5431)
- `redis`: Redis (port 6381)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://... | PostgreSQL connection |
| REDIS_URL | redis://... | Redis connection |
| JWT_SECRET | dev-secret | JWT signing key |
| PORT | 3000 | Server port |

## Production Considerations

1. **Clock Synchronization**: NTP across all servers
2. **WebSocket Scaling**: Redis Pub/Sub for WS broadcast across nodes
3. **Bid Atomicity**: Database advisory locks or serializable isolation
4. **Backup Bidders**: Store all bids even if not winning

## High Availability

- Active-passive database setup
- WebSocket servers with sticky sessions
- Circuit breakers for payment processing
