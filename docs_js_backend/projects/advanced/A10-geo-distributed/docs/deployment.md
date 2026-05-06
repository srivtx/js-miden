# Deployment Guide

## Docker Deployment

```bash
docker-compose up -d
```

Services:
- `us-east` (port 3001)
- `us-west` (port 3002)
- `eu-west` (port 3003)
- Nginx (port 3000)

## Kubernetes Multi-Region

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-us-east
  namespace: us-east
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: a10-geo-distributed:latest
        env:
        - name: REGION
          value: "us-east"
        - name: REPLICAS
          value: "us-west,eu-west"
```

Repeat for each region in separate clusters or namespaces.

## DNS Configuration

Use Route 53 latency-based routing:

```
api.example.com
├── us-east.api.example.com → ALB us-east
├── us-west.api.example.com → ALB us-west
└── eu-west.api.example.com → ALB eu-west
```

## Database Replication

For production, use:
- **MongoDB Atlas Global Clusters**
- **CockroachDB** (geo-partitioned)
- **Spanner** (strong global consistency)

## Monitoring

Per-region metrics:
- Replication lag (ms)
- Conflict rate
- Read/write ratio
- Cross-region bandwidth

## References

[1] "Multi-Region Application Architecture," AWS Well-Architected Framework.
[2] "Global Load Balancing with Kubernetes," Google Cloud, 2023.