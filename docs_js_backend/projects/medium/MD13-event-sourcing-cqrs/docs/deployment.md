# Deployment Guide

## Environment Requirements

| Environment | Node | PostgreSQL |
|-------------|------|------------|
| Development | 20.x | 16.x |
| Staging | 20.x | 16.x |
| Production | 20.x | 16.x (HA) |

## Docker Deployment

### Build Image
```bash
docker build -t md13-event-sourcing-cqrs .
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
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cqrs-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cqrs-server
  template:
    metadata:
      labels:
        app: cqrs-server
    spec:
      containers:
        - name: cqrs-server
          image: md13-event-sourcing-cqrs:latest
          ports:
            - containerPort: 3001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
```

## Scaling Considerations

### Command Side
- Horizontally scalable
- Each command is independent
- Optimistic concurrency control

### Query Side
- Read replicas for scaling
- Caching layer
- Materialized views

### Event Store
- Write-heavy workload
- Consider sharding by aggregate type
- Backup strategy for event log

## Monitoring

### Metrics to Track
- Command execution time
- Event append latency
- Projection lag
- Read model staleness
- Snapshot frequency

### Alerts
- Projection lag > 5 seconds
- Event store write errors
- Read model inconsistency
- Command timeout rate > 1%

## Security Checklist

- [ ] API authentication
- [ ] Input validation
- [ ] Rate limiting
- [ ] PostgreSQL SSL
- [ ] Audit logging
- [ ] Event integrity checks

## Rollback Strategy

```bash
# Tag current version
docker tag md13-event-sourcing-cqrs:latest md13-event-sourcing-cqrs:stable

# Deploy new version
docker-compose up -d

# If issues detected, rollback
docker-compose down
docker tag md13-event-sourcing-cqrs:stable md13-event-sourcing-cqrs:latest
docker-compose up -d
```

## References

- Kubernetes Best Practices: https://kubernetes.io/docs/concepts/
- PostgreSQL HA: https://www.postgresql.org/docs/current/high-availability.html