# MD22 Airline Reservation System

An airline reservation system demonstrating an **overbooking bug**.

## Features

- Flight search (multi-city, flexible dates)
- Interactive seat maps
- Booking classes (economy/business/first)
- Baggage rules engine
- Check-in and boarding pass generation
- Flight status updates

## The Bug

**Overbooking Not Prevented**: The system allows selling more seats than the aircraft capacity because it checks available seats using a simple count query that doesn't account for concurrent bookings.

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
DATABASE_URL="postgresql://airline:airline123@localhost:54322/airline_reservation"
PORT=3000
```

## API Endpoints

- `GET /api/flights` - Search flights
- `GET /api/flights/:id/seats` - Get seat map
- `POST /api/bookings` - Create booking (BUG: overbooking)
- `POST /api/bookings/:id/checkin` - Check in passenger
- `GET /api/bookings/:id/boarding-pass` - Generate boarding pass
- `GET /api/flights/:id/status` - Flight status
