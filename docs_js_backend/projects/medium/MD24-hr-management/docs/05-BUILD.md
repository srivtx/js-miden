# Build Instructions

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or pnpm

## Setup

### 1. Clone and Install

```bash
cd MD24-hr-management
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL on port 54324.

### 3. Environment Configuration

Create `.env`:

```
DATABASE_URL="postgresql://hr:hr123@localhost:54324/hr_management"
PORT=3000
JWT_SECRET="your-super-secret-key-change-in-production"
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

1. Login as any user: `POST /api/auth/login`
2. Get all employees: `GET /api/employees`
3. **Bug**: Response includes `salary` for every employee
4. Even a regular employee can see CEO's salary

## API Examples

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "eng.manager@company.com", "password": "password123"}'
```

### List Employees (BUG: exposes salaries)
```bash
curl http://localhost:3000/api/employees \
  -H "Authorization: Bearer <token>"
```

### Submit Leave
```bash
curl -X POST http://localhost:3000/api/leave \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2024-07-01", "endDate": "2024-07-05", "type": "VACATION"}'
```
