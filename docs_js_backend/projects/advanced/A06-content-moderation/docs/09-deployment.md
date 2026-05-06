# A06: Content Moderation Pipeline - Deployment

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  moderation-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
    restart: unless-stopped
```

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP server port |
| NODE_ENV | development | Environment mode |

## Production Checklist

- [ ] Switch from in-memory storage to PostgreSQL
- [ ] Add Redis for queue management and caching
- [ ] Implement real AI moderation API integration
- [ ] Add row-level locking for human review race condition
- [ ] Fix appeal audit trail (add state transition logs)
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Implement rate limiting on content submission
- [ ] Add GDPR data export/deletion endpoints
- [ ] Deploy with PM2 or Kubernetes

## Scaling Considerations

### Database
- PostgreSQL with ACID transactions for audit integrity
- Read replicas for audit trail queries
- Partitioning by date for large audit tables

### Queue Workers
- Horizontal scaling of queue worker processes
- Dead letter queue for failed jobs
- Job retry with exponential backoff

### Caching
- Redis for content status caching
- Rate limit counters
- Session management
