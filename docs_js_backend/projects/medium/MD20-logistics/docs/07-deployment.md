# Deployment Guide

## Docker Deployment

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment | Yes |
| `PORT` | API port | Yes |
| `DATABASE_URL` | PostgreSQL connection | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |

## Database Migrations

```bash
npx prisma migrate deploy
```

## Health Checks

```bash
curl http://localhost:3004/health
```

## Monitoring

- Shipment delivery times
- Route efficiency metrics
- API response times
- Database query performance

## Security Checklist

- [ ] HTTPS enabled
- [ ] Rate limiting on tracking endpoints
- [ ] Input validation
- [ ] CORS configured
