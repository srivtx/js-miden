# Deployment & Operations

## Docker Compose Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f transcode

# Scale chat service for high concurrency
docker-compose up -d --scale chat=5
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | JWT signing secret | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `STORAGE_PATH` | HLS stream storage path | No (default: ./streams) |
| `RTMP_PORT` | RTMP server port | No (default: 1935) |

## Health Checks

All services expose `/health` endpoint:
```json
{
  "status": "ok",
  "service": "ingest"
}
```

## Monitoring

### Key Metrics
- Active stream count
- Total concurrent viewers
- Chat messages per second
- Transcode queue depth
- Donation volume
- Stream latency ( ingest to HLS )

### Alerts
- Service downtime > 30s
- Transcode queue > 100 jobs
- Viewer count anomalies
- Chat message rate spikes
- Storage capacity > 80%

## Backup Strategy
```bash
# MongoDB backup
docker exec streamforge-mongodb mongodump --out /backup/$(date +%Y%m%d)

# Stream archives
tar -czf streams-$(date +%Y%m%d).tar.gz ./streams

# Redis backup
docker exec streamforge-redis redis-cli BGSAVE
```

## Production Checklist
- [ ] SSL certificates for all endpoints
- [ ] CDN configured for HLS delivery
- [ ] RTMP load balancer deployed
- [ ] MongoDB replica set configured
- [ ] Redis Sentinel for HA
- [ ] Log aggregation (ELK/Loki)
- [ ] Metrics collection (Prometheus/Grafana)
