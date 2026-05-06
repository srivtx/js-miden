# MD23 Insurance Claims Processing System

An insurance claims processing system demonstrating a **duplicate claim detection bypass** bug.

## Features

- Claim submission with document upload stubs
- Fraud detection rules engine
- Workflow engine: submitted → under review → approved/denied → paid
- Adjuster assignment algorithm
- Payment calculation with coverage limits

## The Bug

**Duplicate Claim Detection Bypassed**: Fraudsters can resubmit the same claim with minor field changes (different case, extra whitespace, typos) and the system treats it as a new claim because duplicate detection uses exact string matching instead of fuzzy/normalized matching.

## Architecture

```
src/
├── server.ts          # Express app entry point
├── routes/            # API route definitions
├── controllers/       # Request handlers
├── services/          # Business logic
├── middleware/        # Auth, validation, error handling
├── types/             # TypeScript interfaces
└── utils/             # Helpers
```

## Getting Started

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d

# Setup database
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev

# Run tests
npm test
```

## Environment Variables

```
DATABASE_URL="postgresql://insurance:insurance123@localhost:54323/insurance_claims"
PORT=3000
```

## API Endpoints

- `POST /api/claims` - Submit new claim (BUG: duplicate detection bypassed)
- `GET /api/claims` - List claims
- `GET /api/claims/:id` - Get claim details
- `POST /api/claims/:id/review` - Move to under review
- `POST /api/claims/:id/assign` - Assign adjuster
- `POST /api/claims/:id/decision` - Approve or deny
- `POST /api/claims/:id/pay` - Process payment
