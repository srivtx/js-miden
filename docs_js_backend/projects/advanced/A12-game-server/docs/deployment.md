# Deployment

## Docker Compose

```bash
docker-compose up -d
```

Services:
- Matchmaking Service (port 3021)
- Game State Service (port 3022)
- Leaderboard Service (port 3023)
- Anti-Cheat Service (port 3024)
- PostgreSQL (port 5421)
- Redis (port 6321)

## Scaling

- Game State Service: Shard by session ID
- Matchmaking Service: Keep queue in Redis for horizontal scaling
- Leaderboard: Cache top 100 in Redis

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgres://... | PostgreSQL |
| REDIS_URL | redis://... | Redis |
| JWT_SECRET | dev-secret | Auth secret |
| MAX_SKILL_GAP | 200 | Matchmaking range |
