# Build Instructions

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or pnpm

## Setup

### 1. Clone and Install

```bash
cd MD23-insurance-claims
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL on port 54323.

### 3. Environment Configuration

Create `.env`:

```
DATABASE_URL="postgresql://insurance:insurance123@localhost:54323/insurance_claims"
PORT=3000
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed with test data
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

Server starts on http://localhost:3000

### 6. Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Testing the Bug

1. Submit a claim with description: "Car accident on Main Street"
2. Submit another claim with description: "car accident on main street"
3. **Bug**: Second claim is accepted as new
4. Submit third claim: "Car  accident on Main St."
5. **Bug**: Third claim also accepted

## API Examples

### Submit Claim
```bash
curl -X POST http://localhost:3000/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "policyId": "...",
    "incidentDate": "2024-06-15",
    "description": "Car accident on Main Street",
    "amountRequested": 2500
  }'
```

### Assign Adjuster
```bash
curl -X POST http://localhost:3000/api/claims/.../assign \
  -H "Content-Type: application/json" \
  -d '{"adjusterId": "..."}'
```

### Make Decision
```bash
curl -X POST http://localhost:3000/api/claims/.../decision \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED", "amountApproved": 2000}'
```
