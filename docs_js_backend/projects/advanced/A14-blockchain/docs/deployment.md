# Deployment

## Docker Compose

```bash
docker-compose up -d
```

Services:
- Wallet Service (port 3041)
- Transaction Service (port 3042)
- Block Explorer Service (port 3043)
- Contract Service (port 3044)
- PostgreSQL (port 5441)
- Redis (port 6341)

## Production Considerations

- Use hardware security modules (HSM) for private keys
- Redis for nonce caching with atomic INCR
- WebSocket for pending transaction notifications
- Archive node for full historical data

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgres://... | PostgreSQL |
| REDIS_URL | redis://... | Redis |
| JWT_SECRET | dev-secret | Auth secret |
| CHAIN_ID | 1337 | Blockchain network ID |
