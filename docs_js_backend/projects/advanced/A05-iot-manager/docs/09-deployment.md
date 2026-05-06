# A05: IoT Device Manager - Deployment

## Docker Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  iot-manager:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
    restart: unless-stopped
```

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | HTTP server port |
| NODE_ENV | development | Environment mode |

## Production Checklist

- [ ] Switch from in-memory storage to persistent database
- [ ] Implement MQTT broker for device communication
- [ ] Add Redis for session/command queue management
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure log aggregation (ELK or Loki)
- [ ] Implement TLS/mTLS for device connections
- [ ] Add rate limiting on telemetry ingestion
- [ ] Fix heartbeat race condition (re-fetch device before marking offline)
- [ ] Deploy with PM2 or Kubernetes for horizontal scaling

## Scaling Considerations

### Horizontal Scaling
- Use Redis for shared state across server instances
- Externalize heartbeat monitoring to a dedicated worker
- Use a message queue (RabbitMQ, Kafka) for telemetry ingestion

### Database
- Time-series DB for telemetry (InfluxDB, TimescaleDB)
- PostgreSQL for device metadata and commands
- Redis for caching and real-time state
