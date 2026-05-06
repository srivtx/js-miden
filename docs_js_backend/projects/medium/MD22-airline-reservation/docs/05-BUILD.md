# Build Instructions

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or pnpm

## Setup

### 1. Clone and Install

```bash
cd MD22-airline-reservation
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL on port 54322.

### 3. Environment Configuration

Create `.env`:

```
DATABASE_URL="postgresql://airline:airline123@localhost:54322/airline_reservation"
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

1. Find the small flight (AA999) with 10 seats
2. Create 10 bookings to fill all seats
3. Try to create an 11th booking
4. **Bug**: The 11th booking might succeed if requests are concurrent

## API Examples

### Search Flights
```bash
curl "http://localhost:3000/api/flights?origin=JFK&destination=LAX&date=2024-12-01"
```

### Create Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "...",
    "seatId": "...",
    "passengerName": "John Doe",
    "passengerEmail": "john@example.com",
    "bookingClass": "ECONOMY"
  }'
```

### Check In
```bash
curl -X POST http://localhost:3000/api/bookings/.../checkin
```
