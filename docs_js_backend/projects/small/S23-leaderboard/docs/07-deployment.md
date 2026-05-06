# 07-deployment.md

## Docker

```bash
docker-compose up --build
```

## Production Considerations

- Replace array storage with Redis Sorted Sets
- Database index on `(period, score DESC)`
- Cache top 100 leaderboard in Redis with TTL
- Precompute daily/weekly leaderboards at period boundaries
- Use write-through caching for score submissions

## Scaling

- Redis Cluster for distributed sorted sets
- Read replicas for leaderboard queries
- Sharding by period or game ID
- CDN caching for public leaderboards
