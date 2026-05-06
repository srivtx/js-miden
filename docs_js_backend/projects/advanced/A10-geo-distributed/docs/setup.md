# Setup Guide

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

## Installation

```bash
cd docs_js_backend/projects/advanced/A10-geo-distributed
npm install
docker-compose up -d
```

This starts three regional instances:
- us-east: http://localhost:3001
- us-west: http://localhost:3002
- eu-west: http://localhost:3003

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | API server port |
| REGION | us-east | Region identifier |
| REPLICAS | | Comma-separated peer regions |
| REDIS_URL | | Regional Redis connection |

### Docker Compose

The included `docker-compose.yml` sets up:
- 3 API instances (one per region)
- 3 Redis instances (one per region)
- Nginx load balancer (port 3000)

## Testing Cross-Region Replication

```bash
# Write to us-east
curl -X POST http://localhost:3001/api/data/user-123 \
  -H "Content-Type: application/json" \
  -d '{"value": {"name": "Alice", "balance": 100}}'

# Read from us-west (may be stale initially)
curl http://localhost:3002/api/data/user-123

# Read from eu-west
curl http://localhost:3003/api/data/user-123
```

## Simulating a Conflict

```bash
# Terminal 1: Update in us-east
curl -X POST http://localhost:3001/api/data/user-123 \
  -d '{"value": {"balance": 100}}'

# Terminal 2: Update in us-west (before replication)
curl -X POST http://localhost:3002/api/data/user-123 \
  -d '{"value": {"balance": 200}}'

# Check conflicts
curl http://localhost:3001/api/conflicts
```

## Verification

```bash
# Run tests
npm test

# Check regional health
curl http://localhost:3001/api/health
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
```

## References

[1] Docker Compose Multi-Container Apps. https://docs.docker.com/compose/
[2] Redis Replication. https://redis.io/docs/management/replication/