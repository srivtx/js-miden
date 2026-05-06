# Deployment Guide

## Environment Requirements

| Environment | Node | PostgreSQL | Redis |
|-------------|------|------------|-------|
| Development | 20.x | 16.x | 7.x |
| Staging | 20.x | 16.x | 7.x |
| Production | 20.x | 16.x (HA) | 7.x (Cluster) |

## Docker Deployment

### Build Image
```bash
docker build -t md12-realtime-analytics .
```

### Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN npx prisma generate
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: analytics-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: analytics-server
  template:
    metadata:
      labels:
        app: analytics-server
    spec:
      containers:
        - name: analytics-server
          image: md12-realtime-analytics:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-secret
                  key: url
```

## Scaling Considerations

### Horizontal Scaling
- Multiple ingestion nodes behind load balancer
- Redis Cluster for distributed aggregation
- PostgreSQL read replicas for dashboard queries

### Vertical Scaling
- More CPU for aggregation calculations
- More memory for Redis caching
- Faster disks for PostgreSQL

## Monitoring

### Metrics to Track
- Events ingested per second
- Aggregation latency
- Redis memory usage
- PostgreSQL connection count
- Dashboard API response times

### Alerts
- Event ingestion rate drops
- Redis memory > 80%
- PostgreSQL connections > 80%
- Dashboard API errors > 1%

## Security Checklist

- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] Redis password protected
- [ ] PostgreSSL enabled
- [ ] CORS configured
- [ ] API keys for ingestion

## Rollback Strategy

```bash
# Tag current version
docker tag md12-realtime-analytics:latest md12-realtime-analytics:stable

# Deploy new version
docker-compose up -d

# If issues detected, rollback
docker-compose down
docker tag md12-realtime-analytics:stable md12-realtime-analytics:latest
docker-compose up -d
```

## References

- Kubernetes Best Practices: https://kubernetes.io/docs/concepts/
- Redis Cluster Setup: https://redis.io/docs/management/scaling/