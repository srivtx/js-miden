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
docker build -t md11-graphql-server .
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
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

### docker-compose.yml
```yaml
services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://graphql:secret@postgres:5432/graphql_db
      REDIS_URL: redis://redis:6379
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: graphql-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: graphql-server
  template:
    metadata:
      labels:
        app: graphql-server
    spec:
      containers:
        - name: graphql-server
          image: md11-graphql-server:latest
          ports:
            - containerPort: 4000
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
- Run multiple Apollo Server instances
- Use Redis for PubSub (subscriptions across instances)
- Use PostgreSQL read replicas for queries

### Vertical Scaling
- Increase CPU for complexity analysis
- Increase memory for DataLoader caching
- Use connection pooling (PgBouncer)

## Monitoring

### Metrics to Track
- Query execution time (p50, p95, p99)
- Query complexity scores
- N+1 query occurrences
- Subscription connection count
- Redis cache hit rate

### Tools
- Apollo Studio: https://studio.apollographql.com/
- Prometheus + Grafana
- DataDog
- New Relic

## Security Checklist

- [ ] Disable introspection in production
- [ ] Enable persisted queries
- [ ] Set query complexity limits
- [ ] Set query depth limits (currently disabled - fix before production)
- [ ] Use CORS whitelist
- [ ] Enable rate limiting
- [ ] Use HTTPS/WSS
- [ ] Rotate JWT secrets

## Rollback Strategy

```bash
# Tag current version
docker tag md11-graphql-server:latest md11-graphql-server:stable

# Deploy new version
docker-compose up -d

# If issues detected, rollback
docker-compose down
docker tag md11-graphql-server:stable md11-graphql-server:latest
docker-compose up -d
```

## References

- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/
- Kubernetes Patterns: https://k8s.io/docs/concepts/