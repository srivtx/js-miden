# Build Instructions

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or pnpm

## Setup

### 1. Clone and Install

```bash
cd MD21-hotel-booking
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL on port 54321 and Redis on port 63791.

### 3. Environment Configuration

Create `.env`:

```
DATABASE_URL="postgresql://hotel:hotel123@localhost:54321/hotel_booking"
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

### 7. Build for Production

```bash
npm run build
npm start
```

## Database Schema Changes

```bash
# After modifying schema.prisma
npm run db:migrate
```

## Troubleshooting

**Port already in use**: Change ports in `docker-compose.yml` and `.env`
**Migration conflicts**: Reset with `npx prisma migrate reset`
**Type errors**: Ensure `npm run db:generate` has been run after schema changes
