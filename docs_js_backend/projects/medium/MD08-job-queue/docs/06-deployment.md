# Deployment

## Docker

```bash
docker compose up -d
```

This starts both PostgreSQL and Redis containers.

## Environment Variables

| Variable    | Default      | Description         |
|-------------|--------------|---------------------|
| DB_HOST     | localhost    | PostgreSQL host     |
| DB_PORT     | 5435         | PostgreSQL port     |
| DB_USER     | jobs         | Database user       |
| DB_PASSWORD | jobspass     | Database password   |
| DB_NAME     | jobsdb       | Database name       |
| REDIS_HOST  | localhost    | Redis host          |
| REDIS_PORT  | 6379         | Redis port          |
| PORT        | 3000         | API port            |

## Running Workers

Start the API server and workers separately:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:worker
```

## Production Checklist

- [ ] Run workers on separate machines/ containers from API
- [ ] Monitor Redis memory usage and eviction policies
- [ ] Set up alerts for dead jobs
- [ ] Implement job priorities (BullMQ supports numeric priorities)
- [ ] Add graceful shutdown (finish current jobs before exit)
