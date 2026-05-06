# 05-configuration.md

## Environment Variables

| Variable    | Default               | Description              |
|-------------|-----------------------|--------------------------|
| PORT        | 3000                  | HTTP server port         |
| REDIS_URL   | redis://localhost:6379| Redis connection string  |
| SMTP_HOST   | smtp.example.com      | SMTP server host         |
| SMTP_PORT   | 587                   | SMTP server port         |
| SMTP_USER   | —                     | SMTP authentication user |
| SMTP_PASS   | —                     | SMTP authentication pass |

## Templates

Templates are hardcoded in `src/service.ts` for Phase 1. In production, move to database or file storage.

## Docker

```bash
docker-compose up
```

Spins up the app and Redis for queue persistence.
