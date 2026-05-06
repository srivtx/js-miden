# 07-deployment.md

## Docker

```bash
docker-compose up --build
```

## Production Considerations

- Replace in-memory store with PostgreSQL
- Add composite unique index `(user_id, product_id)`
- Implement pagination for large wishlists
- Background job for price change detection
- Email/push notification integration for price drops

## Scaling

- Database read replicas for GET requests
- Caching frequently accessed wishlists in Redis
- Async price checking with message queues
- Sharding by user_id for massive scale
