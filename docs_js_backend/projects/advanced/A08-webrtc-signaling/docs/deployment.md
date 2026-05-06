# Deployment Guide

## Docker Deployment

### Production Build

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### docker-compose.yml

The included compose file sets up:
- Signaling server (3 replicas in production)
- TURN server (coturn)
- Redis (for cross-instance pub/sub)
- Prometheus (monitoring)

```bash
docker-compose up -d --scale signaling=3
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: signaling-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: signaling
  template:
    metadata:
      labels:
        app: signaling
    spec:
      containers:
      - name: signaling
        image: a08-webrtc-signaling:latest
        ports:
        - containerPort: 3000
        env:
        - name: REDIS_URL
          value: "redis://redis:6379"
---
apiVersion: v1
kind: Service
metadata:
  name: signaling-service
spec:
  selector:
    app: signaling
  ports:
  - port: 3000
  type: LoadBalancer
```

## Scaling Considerations

| Metric | Limit | Action |
|--------|-------|--------|
| Peers per room | 8 | Hard limit (video bandwidth) |
| Rooms per server | 1000 | Horizontal scale at 80% |
| WebSocket connections | 10,000 | Add instance |

## SSL/TLS

Use nginx or traefik for SSL termination:

```nginx
server {
    listen 443 ssl;
    server_name signaling.example.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location / {
        proxy_pass http://signaling_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Monitoring

Prometheus metrics endpoint at `/metrics`:
- `webrtc_peers_connected_total`
- `webrtc_rooms_active`
- `webrtc_ice_candidates_total`
- `websocket_messages_received`

## References

[1] Docker Best Practices for Node.js. https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
[2] Kubernetes WebSocket Load Balancing. https://kubernetes.io/docs/concepts/services-networking/service/