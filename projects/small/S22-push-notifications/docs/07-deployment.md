# 07-deployment.md

## Docker

```bash
docker-compose up --build
```

## Production Considerations

- Replace mock providers with real FCM/APNS SDKs
- Store tokens in database with indexing by userId
- Implement token cleanup for invalid/unregistered tokens
- Use provider batch APIs for high throughput
- Add rate limiting per user and per app

## Scaling

- Connection pooling to FCM/APNS
- Redis for token caching and deduplication
- Horizontal scaling with stateless API servers
- Message queue for high-volume notification bursts
