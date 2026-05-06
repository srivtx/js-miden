# MD21 Hotel Booking System

A Booking.com clone demonstrating a **race condition bug** in room availability checking.

## Features

- Room inventory management with availability calendar
- Dynamic pricing tiers (weekday/weekend/seasonal)
- Reservation holds (soft booking with expiry)
- Overbooking protection
- Cancellation policies and refund processing

## The Bug

**Race Condition**: Two users can simultaneously book the last available room because availability is checked and booked in two separate, non-atomic operations.

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
DATABASE_URL="postgresql://hotel:hotel123@localhost:54321/hotel_booking"
PORT=3000
```

## API Endpoints

- `GET /api/rooms` - List available rooms
- `GET /api/rooms/:id/availability` - Check availability calendar
- `POST /api/bookings` - Create booking (BUG: race condition)
- `POST /api/bookings/:id/cancel` - Cancel booking
- `GET /api/bookings/:id` - Get booking details
