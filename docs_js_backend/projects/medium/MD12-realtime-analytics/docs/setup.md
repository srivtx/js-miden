# Setup Guide

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 16
- Redis >= 7
- Docker & Docker Compose (optional)

## Installation

### 1. Clone and Install
```bash
cd docs_js_backend/projects/medium/MD12-realtime-analytics
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://analytics:analytics_secret@localhost:5433/analytics_db
REDIS_URL=redis://localhost:6380
AGGREGATION_WINDOW_MS=60000
METRICS_RETENTION_HOURS=24
RATE_LIMIT_RPS=10000
EVENT_BATCH_SIZE=100
```

### 3. Database Setup
```bash
# Using Docker
docker-compose up -d postgres redis

# Manual setup
createdb analytics_db
```

### 4. Run Migrations
```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Start Server
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Docker Deployment

```bash
docker-compose up --build
```

## Verification

### Health Check
```bash
curl http://localhost:3000/health
```

### Send Test Event
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"eventType": "test", "payload": {"value": 1}}'
```

### Check Metrics
```bash
curl http://localhost:3000/metrics
curl "http://localhost:3000/metrics/timeseries?eventType=test&hours=1"
```

## Development Workflow

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Troubleshooting

### Redis Connection Failed
```bash
redis-cli -p 6380 ping
# Should return PONG
```

### Database Connection Failed
```bash
psql postgresql://analytics:analytics_secret@localhost:5433/analytics_db
```

## Performance Tuning

### Redis Memory
```bash
# Monitor memory usage
redis-cli -p 6380 INFO memory

# Set max memory policy
redis-cli -p 6380 CONFIG SET maxmemory-policy allkeys-lru
```

### PostgreSQL Tuning
```sql
-- Increase connection limit
ALTER SYSTEM SET max_connections = 200;

-- Tune shared buffers
ALTER SYSTEM SET shared_buffers = '2GB';
```

## References

- Redis Documentation: https://redis.io/documentation
- PostgreSQL Performance: https://wiki.postgresql.org/wiki/Performance_Optimization