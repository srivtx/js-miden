# 05-configuration.md

## Environment Variables

| Variable    | Default              | Description             |
|-------------|----------------------|-------------------------|
| PORT        | 3000                 | HTTP server port        |
| REDIS_URL   | redis://localhost:6379 | Redis for sorted sets |

## Scoring Rules

- `daily` — resets at midnight UTC
- `weekly` — resets at Sunday midnight UTC
- `all-time` — never resets

## Docker

```bash
docker-compose up
```

Redis recommended for sorted set-based indexing in production.
