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
curl http://localhost:3002/health
```

## Monitoring

- Course enrollment rates
- Quiz completion rates
- Average course completion time
- API response times

## Security Checklist

- [ ] HTTPS enabled
- [ ] JWT secrets rotated
- [ ] Rate limiting configured
- [ ] Input validation active
- [ ] CORS configured
