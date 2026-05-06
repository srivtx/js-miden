# 05-configuration.md

## Environment Variables

| Variable       | Default                | Description              |
|----------------|------------------------|--------------------------|
| PORT           | 3000                   | HTTP server port         |
| REDIS_URL      | redis://localhost:6379 | Redis session store      |
| SESSION_SECRET | change-me              | Cookie signing secret    |
| CART_TTL_HOURS | 24                     | Cart expiry in hours     |

## Redis Structure

```
HGETALL cart:<cartId>  → serialized cart JSON
TTL cart:<cartId>      → remaining seconds
```

## Docker

```bash
docker-compose up
```

Runs app with Redis for session persistence.
