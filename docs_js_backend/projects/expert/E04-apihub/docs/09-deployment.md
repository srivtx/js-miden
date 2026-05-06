# 09 - Deployment and Operations

## WHAT

This document covers deploying ApiHub to production environments, monitoring, scaling, and operational procedures.

## WHY

A multi-service architecture is more complex to deploy than a monolith. Proper deployment strategy ensures:
- Zero-downtime updates
- Rollback capability
- Horizontal scaling under load
- Observable system health

## HOW

### Docker Compose (Development)

The included `docker-compose.yml` orchestrates all 6 services plus Redis:

```bash
# Start everything
docker-compose up --build

# Scale gateway to 3 instances
docker-compose up --scale gateway=3

# View logs
docker-compose logs -f gateway

# Restart single service
docker-compose restart usage
```

### Service Dependencies

```
Redis (start first)
    |
    +---> Auth
    +---> Usage
    +---> Billing
    +---> Analytics
    +---> Developer Portal
    |
    +---> Gateway (depends on all others)
```

### Production Architecture

```
                    +------------------+
                    |   Cloudflare     |
                    |   (DDoS/WAF)     |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  AWS ALB / Nginx |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
       +------v------+ +-----v------+ +----v------+
       | Gateway 1   | | Gateway 2  | | Gateway 3 |
       +------+------+ +-----+------+ +----+------+
              |              |              |
              +--------------+--------------+
                             |
                    +--------v---------+
                    |     Redis        |
                    |   (ElastiCache)  |
                    +--------+---------+
                             |
        +--------------------+--------------------+
        |                    |                    |
+-------v------+    +--------v--------+   +-------v-------+
| Auth Service |    | Usage Service   |   | Billing Svc   |
| (ECS/Fargate)|    | (ECS/Fargate)   |   | (ECS/Fargate) |
+--------------+    +--------+--------+   +---------------+
                             |
                    +--------v--------+
                    | Analytics Svc   |
                    | (ECS/Fargate)   |
                    +-----------------+
                             |
                    +--------v--------+
                    | Developer Portal|
                    | (ECS/Fargate)   |
                    +-----------------+
```

### Environment Configuration

```bash
# .env.production
NODE_ENV=production

# Gateway
GATEWAY_PORT=3000
AUTH_SERVICE_URL=http://auth.internal:3001
USAGE_SERVICE_URL=http://usage.internal:3002
BILLING_SERVICE_URL=http://billing.internal:3003
ANALYTICS_SERVICE_URL=http://analytics.internal:3004
PORTAL_SERVICE_URL=http://portal.internal:3005

# Auth
AUTH_PORT=3001
JWT_SECRET=<generate with openssl rand -hex 32>
REDIS_URL=redis://redis.internal:6379

# Usage
USAGE_PORT=3002
REDIS_URL=redis://redis.internal:6379

# Billing
BILLING_PORT=3003
STRIPE_SECRET_KEY=<encrypted>
REDIS_URL=redis://redis.internal:6379

# Analytics
ANALYTICS_PORT=3004
POSTGRES_URL=postgresql://analytics:password@db.internal:5432/analytics

# Developer Portal
PORTAL_PORT=3005
REDIS_URL=redis://redis.internal:6379
```

### Health Checks

Every service exposes `/health`:

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    redis: await checkRedisConnection(),
    dependencies: {
      auth: await checkAuthHealth(),
      usage: await checkUsageHealth()
    }
  };
  
  const healthy = checks.redis && 
    Object.values(checks.dependencies).every(d => d.healthy);
  
  res.status(healthy ? 200 : 503).json(checks);
});
```

### Scaling Guidelines

| Service | CPU | Memory | Instances | Scaling Trigger |
|---------|-----|--------|-----------|-----------------|
| Gateway | 1 core | 2GB | 3-10 | CPU > 70% |
| Auth | 0.5 core | 1GB | 2-4 | Latency > 100ms |
| Usage | 1 core | 2GB | 2-6 | Request rate |
| Billing | 0.5 core | 1GB | 1-2 | Queue depth |
| Analytics | 2 cores | 4GB | 1-2 | Query load |
| Portal | 0.5 core | 1GB | 2-3 | Session count |

### Monitoring and Alerting

**Key Metrics:**
- `gateway.request_rate` - requests per second
- `gateway.error_rate` - 5xx percentage
- `gateway.latency_p99` - tail latency
- `auth.validation_latency` - key validation time
- `usage.aggregation_lag` - time between request and aggregate update
- `billing.invoice_generation_duration` - monthly billing job time

**Alerts:**
- `gateway.error_rate > 1%` for 5 minutes -> PagerDuty
- `gateway.latency_p99 > 1000ms` -> Slack warning
- `redis.memory_usage > 80%` -> Scale Redis or review TTLs
- `billing.invoice_generation_duration > 1 hour` -> Manual investigation

### Backup Strategy

| Data | Retention | Method |
|------|-----------|--------|
| Redis (rate limits, caches) | 1 day | ElastiCache snapshots |
| Usage aggregates | 7 years | PostgreSQL streaming replica |
| Raw usage events | 90 days | S3 + Glacier |
| Invoices | 7 years | PostgreSQL + S3 archives |

### Disaster Recovery

**Scenario: Redis Failure**
1. Gateway falls back to per-instance rate limiting (less accurate but functional)
2. Usage service queues events to local disk
3. Restore Redis from snapshot
4. Replay queued events

**Scenario: Auth Service Down**
1. Gateway uses cached key validation results (TTL: 5 minutes)
2. New subscriptions blocked
3. Existing API access continues
4. Restore Auth service

**Scenario: Billing Service Down**
1. No impact on API access
2. Usage continues tracking
3. Billing job resumes when service recovers
4. Invoice generation catches up

## WRONG vs RIGHT

### WRONG: Deploying All Services Together

```yaml
# WRONG: Single deployment unit
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apihub  # One deployment for everything
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: apihub
        image: apihub:latest  # All 6 services in one image!
```

**Why Wrong:** Can't scale Gateway independently of Billing. A Billing bug requires rolling back Gateway too. 5-minute Billing cron job runs on all 3 instances.

### RIGHT: Independent Service Deployments

```yaml
# RIGHT: Separate deployments per service
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: gateway
        image: apihub/gateway:v1.2.3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: billing
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: billing
        image: apihub/billing:v1.1.0
```

**Why Right:** Gateway scales to 10 instances during traffic spikes. Billing stays at 1 instance. Services version independently.

### WRONG: No Health Checks in Docker Compose

```yaml
# WRONG: No health checks
services:
  gateway:
    build: .
    depends_on:
      - redis  # Only waits for container start, not readiness
```

**Why Wrong:** Gateway starts before Redis is ready. Initial requests fail. No restart on crash.

### RIGHT: Comprehensive Health Checks

```yaml
# RIGHT: Health checks with proper startup order
services:
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  gateway:
    build: .
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

**Why Right:** Gateway waits for Redis to be truly ready. Docker restarts Gateway if health checks fail.

### WRONG: Hardcoded Service URLs

```typescript
// WRONG: URLs compiled into code
const AUTH_URL = 'http://auth-service.default.svc.cluster.local:3001';
```

**Why Wrong:** Can't run locally. Can't change without rebuild. Environment-specific config leaks into source code.

### RIGHT: Environment-Based Configuration

```typescript
// RIGHT: URLs from environment
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
```

**Why Right:** Same container image runs in dev, staging, and production. Configuration is environment-specific, not code-specific.

### WRONG: Running as Root in Containers

```dockerfile
# WRONG: Running as root
FROM node:20
COPY . /app
CMD ["node", "index.js"]  # Runs as root
```

**Why Wrong:** Container escape vulnerability gives attacker root on host. Violates principle of least privilege.

### RIGHT: Non-Root Container User

```dockerfile
# RIGHT: Dedicated user
FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
COPY --chown=nodejs:nodejs . /app
USER nodejs
CMD ["node", "index.js"]
```

**Why Right:** Limited blast radius if container is compromised. Follows security best practices.
