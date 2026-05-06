# Setup Guide

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 16
- Docker & Docker Compose (optional)

## Installation

### 1. Clone and Install
```bash
cd docs_js_backend/projects/medium/MD13-event-sourcing-cqrs
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://cqrs:cqrs_secret@localhost:5434/cqrs_db
EVENTUAL_CONSISTENCY_TIMEOUT_MS=5000
SNAPSHOT_FREQUENCY=100
COMMAND_TIMEOUT_MS=30000
READ_MODEL_CACHE_TTL_MS=60000
```

### 3. Database Setup
```bash
# Using Docker
docker-compose up -d postgres

# Manual setup
createdb cqrs_db
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
curl http://localhost:3001/health
```

### Place Order
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      {
        "productId": "550e8400-e29b-41d4-a716-446655440001",
        "quantity": 2,
        "unitPrice": 29.99
      }
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "Springfield",
      "country": "USA",
      "zipCode": "12345"
    }
  }'
```

### Get Order
```bash
curl http://localhost:3001/orders/{orderId}
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

### Database Connection Failed
```bash
psql postgresql://cqrs:cqrs_secret@localhost:5434/cqrs_db
```

### Eventual Consistency Issues
```bash
# Check if projection ran
SELECT * FROM order_read_model WHERE aggregate_id = '...';

# Check events
SELECT * FROM event_store WHERE aggregate_id = '...' ORDER BY version;
```

## Performance Tuning

### PostgreSQL
```sql
-- Increase connection limit
ALTER SYSTEM SET max_connections = 200;

-- Tune for event store
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
```

## References

- Node.js Installation: https://nodejs.org/
- PostgreSQL Installation: https://www.postgresql.org/download/
- Prisma Documentation: https://www.prisma.io/docs/