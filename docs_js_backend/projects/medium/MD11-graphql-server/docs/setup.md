# Setup Guide

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 16
- Redis >= 7
- Docker & Docker Compose (optional)

## Installation

### 1. Clone and Install
```bash
cd docs_js_backend/projects/medium/MD11-graphql-server
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://graphql:graphql_secret@localhost:5432/graphql_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
QUERY_DEPTH_LIMIT=10
QUERY_COMPLEXITY_LIMIT=1000
```

### 3. Database Setup
```bash
# Using Docker
docker-compose up -d postgres redis

# Manual setup
createdb graphql_db
```

### 4. Run Migrations
```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Seed Data
```bash
npm run db:seed
```

### 6. Start Server
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
curl http://localhost:4000/health
```

### GraphQL Playground
```
http://localhost:4000/graphql
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

### Port Already in Use
```bash
lsof -i :4000
kill -9 <PID>
```

### Database Connection Failed
```bash
# Check PostgreSQL
psql postgresql://graphql:graphql_secret@localhost:5432/graphql_db

# Check Redis
redis-cli ping
```

## References

- Node.js Installation: https://nodejs.org/
- PostgreSQL Installation: https://www.postgresql.org/download/
- Redis Installation: https://redis.io/download