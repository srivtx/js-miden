# Deployment Guide

## Docker Deployment

```bash
docker-compose up -d
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: datasync-sync
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: sync
        image: e03-datasync:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: datasync-storage
spec:
  serviceName: storage
  replicas: 1
  template:
    spec:
      containers:
      - name: storage
        image: e03-datasync-storage:latest
        ports:
        - containerPort: 3003
```

## Scaling Strategies

| Component | Scaling Method |
|-----------|---------------|
| Sync Service | Horizontal (WebSocket connections) |
| Presence Service | Horizontal (sticky sessions) |
| Storage Service | Vertical (PostgreSQL) |
| Conflict Service | Horizontal (stateless) |

## Database Schema

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  vector_clock JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  tombstone BOOLEAN DEFAULT FALSE
);

CREATE TABLE tombstones (
  document_id TEXT PRIMARY KEY,
  deleted_at BIGINT NOT NULL,
  vector_clock JSONB NOT NULL
);

CREATE INDEX idx_documents_tombstone ON documents(tombstone);
```

## Monitoring

Prometheus metrics:
- `sync_connections_active`
- `sync_documents_total`
- `sync_conflicts_resolved_total`
- `sync_presence_peers_online`

## References

[1] "Kubernetes StatefulSets for Databases." https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/
[2] "PostgreSQL Replication." https://www.postgresql.org/docs/current/high-availability.html