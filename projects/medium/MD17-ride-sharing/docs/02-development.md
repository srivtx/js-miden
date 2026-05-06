# Development Setup

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

## Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Configure database connection string

## Database Setup

```bash
# Start PostgreSQL
docker-compose up -d db

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npm run db:generate

# Seed database
npm run db:seed
```

## Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Build for production
npm run build

# Start production server
npm run start
```

## Project Structure

```
.
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── routes/          # Route definitions
│   ├── middleware/      # Express middleware
│   ├── types/           # TypeScript types
│   └── utils/           # Utilities
├── tests/               # Test suites
├── prisma/              # Database schema
├── docs/                # Documentation
└── docker-compose.yml   # Docker services
```

## Testing

Tests are written using Vitest and Supertest.

## Code Style

- TypeScript strict mode enabled
- ESM modules throughout
- Async/await for asynchronous operations
- Error handling via middleware
