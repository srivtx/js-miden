# Deployment

## Docker Compose

```bash
docker-compose up -d
```

Services:
- FHIR API Service (port 3031)
- Audit Service (port 3032)
- Consent Service (port 3033)
- PostgreSQL (port 5431)
- Redis (port 6331)

## Production Considerations

- TLS 1.3 everywhere
- Database encryption at rest (TDE)
- Field-level encryption keys in HSM/Vault
- Audit logs to immutable storage (WORM)
- Regular penetration testing

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgres://... | PostgreSQL |
| REDIS_URL | redis://... | Redis |
| JWT_SECRET | dev-secret | Auth secret |
| ENCRYPTION_KEY | dev-key | AES-256 key |
