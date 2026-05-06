# ApiHub - API Marketplace

ApiHub is a production-grade API marketplace platform inspired by RapidAPI and Stripe. It enables developers to register APIs, consumers to subscribe with API keys, and provides usage tracking, billing, rate limiting, and analytics.

## Architecture

```
                    +------------------+
                    |   Load Balancer  |
                    +--------+---------+
                             |
                    +--------v---------+
                    | Gateway Service  |
                    |  (Port 3000)     |
                    +--------+---------+
                             |
        +--------------------+--------------------+
        |                    |                    |
+-------v------+    +--------v--------+   +-------v-------+
| Auth Service |    | Usage Service   |   | Billing Svc   |
| (Port 3001)  |    | (Port 3002)     |   | (Port 3003)   |
+--------------+    +--------+--------+   +---------------+
                             |
                    +--------v--------+
                    | Analytics Svc   |
                    | (Port 3004)     |
                    +-----------------+
                             |
                    +--------v--------+
                    | Developer Portal|
                    | (Port 3005)     |
                    +-----------------+
```

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| Gateway | 3000 | Request routing, rate limiting, key validation, forwarding |
| Auth | 3001 | Developer auth, API key generation/rotation/validation |
| Usage | 3002 | Real-time usage tracking, aggregation, quotas |
| Billing | 3003 | Tier calculations, invoicing, payment processing |
| Analytics | 3004 | Dashboard data, metrics aggregation, reporting |
| Developer Portal | 3005 | API registration, subscription management, webhooks |

## Quick Start

```bash
# Install dependencies
npm install

# Start all services with Docker
docker-compose up --build

# Run all tests
npm test

# Run only integration tests
npm run test:integration
```

## Phase 1 Features

- API registration by developers
- Consumer subscription with API keys
- Usage tracking per key
- Billing based on usage tiers
- Rate limits per subscription tier
- Developer dashboard with analytics

## Phase 2-3 Features

- API Gateway pattern with centralized routing
- Atomic usage aggregation with Redis transactions
- Tier enforcement with cryptographic verification
- Key rotation with zero downtime
- Webhook notifications for developers
- Cross-service event streaming

## Bug Demonstration

This project contains intentional security bugs with failing tests demonstrating:
- Cross-developer API key access vulnerability
- Non-atomic usage aggregation leading to double-counting
- Tier enforcement bypass via header manipulation

See `docs/` for detailed analysis of each vulnerability.

## Documentation

Comprehensive documentation is available in `docs/`:

1. `01-architecture.md` - System architecture and design decisions
2. `02-gateway-service.md` - Gateway pattern, routing, rate limiting
3. `03-auth-service.md` - Authentication, key management, rotation
4. `04-usage-service.md` - Usage tracking, aggregation, quotas
5. `05-billing-service.md` - Tier calculations, invoicing, webhooks
6. `06-analytics-service.md` - Metrics, dashboards, reporting
7. `07-developer-portal.md` - API registration, subscriptions
8. `08-security-bugs.md` - Vulnerability analysis (WHAT, WHY, HOW, WRONG vs RIGHT)
9. `09-deployment.md` - Docker, scaling, monitoring

## License

MIT
