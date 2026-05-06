# E06 Streaming Platform — Deployment

## Docker Compose
8 services are orchestrated via `docker-compose.yml`. Each service has its own build context and Dockerfile.

## Production Checklist
- Replace in-memory stores with PostgreSQL
- Add Redis for caching manifests and recommendations
- Use S3/MinIO for raw uploads and transcoded outputs
- Deploy CDN edge nodes for stream delivery
- Add Kubernetes HPA for transcode workers
- Integrate real DRM (Widevine/PlayReady/FairPlay)
- Configure Prometheus/Grafana monitoring

## Scaling
- Transcode service is the bottleneck; use queue-based workers (Bull/BullMQ)
- Stream service should be stateless and horizontally scalable
- Analytics can be offloaded to a data warehouse
