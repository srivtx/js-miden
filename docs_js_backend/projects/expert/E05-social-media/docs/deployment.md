# E05 Social Media Platform — Deployment

## Docker Compose
All 10 services are orchestrated via `docker-compose.yml`. Each service builds from its own directory.

## Production Checklist
- Replace in-memory stores with PostgreSQL/Redis
- Add reverse proxy (nginx/traefik) with TLS
- Centralize logs (ELK/Loki)
- Add service discovery (Consul/etcd)
- Configure CI/CD pipelines per service
- Set up monitoring (Prometheus + Grafana)
- Rotate JWT secrets via vault

## Scaling
- Stateless services can be horizontally scaled
- Feed and recommendation services may need caching layers
- Media service requires object storage (S3/MinIO)
