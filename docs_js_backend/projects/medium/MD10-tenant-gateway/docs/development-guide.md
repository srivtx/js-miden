# Development Guide

## Setup

```bash
npm install
docker-compose up -d postgres redis
npm run dev
```

## Project Structure

```
src/
  index.ts          # Entry point
  config.ts         # Configuration
  db.ts             # Database connections
  middleware/       # Rate limiting, tenant resolution
  routes/           # API routes
  types.ts          # TypeScript types
tests/              # Test suites
docs/               # Documentation
```

## Running Tests

```bash
npm test
```

## Debugging Tenant Spoofing

The spoofing bug is in `src/routes/gateway.ts`:
- Reads tenant ID from `X-Tenant-ID` header
- Validates API key but doesn't check it belongs to that tenant
- Fix: Look up tenant by API key hash, ignore header

## Debugging Rate Limiting

The rate limit bug is in `src/middleware/rateLimit.ts`:
- Uses `req.ip` as the rate limit key
- Fix: Use `req.tenantId` after proper authentication
