# Deployment Guide

## Docker Deployment

### Production Setup

```bash
# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f app

# Scale API instances
docker-compose up -d --scale app=3
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | API port | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `REDIS_URL` | Redis connection string | No |

## Database Migrations

```bash
# Create migration
npx prisma migrate dev --name add_feature

# Deploy to production
npx prisma migrate deploy

# Generate client
npx prisma generate
```

## Health Checks

The application exposes a health endpoint:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Monitoring

### Key Metrics
- Order completion rate
- Average delivery time
- Driver assignment success rate
- API response times
- Error rates

### Log Aggregation
Configure centralized logging with:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog
- New Relic

## Scaling

### Horizontal Scaling
- Use load balancer (Nginx/HAProxy)
- Stateless API design
- Shared session store (Redis)

### Database Scaling
- Read replicas for queries
- Connection pooling (PgBouncer)
- Partitioning for large tables

## Security Checklist

- [ ] HTTPS enabled
- [ ] JWT secrets rotated
- [ ] Database credentials secure
- [ ] Rate limiting configured
- [ ] Input validation active
- [ ] CORS properly configured
- [ ] Security headers set (Helmet)
