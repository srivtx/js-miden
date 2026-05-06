# Deployment Guide

## Docker Deployment

### Production Setup

```bash
# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f app
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment | Yes |
| `PORT` | API port | Yes |
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `REDIS_URL` | Redis connection | No |

## Database Migrations

```bash
# Create migration
npx prisma migrate dev --name add_feature

# Deploy to production
npx prisma migrate deploy
```

## Health Checks

```bash
curl http://localhost:3001/health
```

## Monitoring

### Key Metrics
- Ride completion rate
- Average pickup time
- Driver acceptance rate
- Surge pricing accuracy
- API response times

## Scaling

### Horizontal Scaling
- Load balancer
- Stateless API design
- Shared session store (Redis)

### Database Scaling
- Read replicas
- Connection pooling
- Partitioning for rides table

## Security Checklist

- [ ] HTTPS enabled
- [ ] JWT secrets rotated
- [ ] Rate limiting configured
- [ ] Input validation active
- [ ] CORS properly configured
- [ ] Helmet security headers
