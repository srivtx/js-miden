# Deployment & Operations

## Docker Compose Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f task

# Scale notification service
docker-compose up -d --scale notification=3
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | JWT signing secret | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `STRIPE_SECRET_KEY` | Stripe API key | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Yes |
| `STORAGE_PATH` | File upload directory | No (default: ./uploads) |

## Health Checks

All services expose `/health` endpoint:
```json
{
  "status": "ok",
  "service": "auth"
}
```

## Monitoring

### Key Metrics
- Request rate per service
- Error rate (target: < 0.1%)
- SSE connection count
- File storage utilization
- Subscription MRR

### Alerts
- Service downtime > 30s
- Error rate > 1%
- SSE connection spikes (>1000 concurrent)
- Disk usage > 80%

## Database Backups
```bash
# MongoDB backup
docker exec mongodb mongodump --out /backup/$(date +%Y%m%d)

# Redis backup
docker exec redis redis-cli BGSAVE
```

## Scaling Strategy
| Service | Scaling Method |
|---------|---------------|
| Gateway | Horizontal + Load Balancer |
| Auth | Horizontal (stateless) |
| Task | Horizontal + DB Read Replicas |
| Notification | Horizontal + Redis Pub/Sub |
| File | Horizontal + Shared Storage |
