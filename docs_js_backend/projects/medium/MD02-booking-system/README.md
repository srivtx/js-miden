# MD02: Booking System

A production-ready room/resource booking system with availability calendar, time slot management, and cancellation policies.

## Architecture

- **Express 5** with TypeScript (ESM)
- **Prisma ORM** with PostgreSQL
- **Redis** for slot holds and caching
- **Zod** for request validation
- **date-fns** for date manipulation

## Thinking Framework

### Phase 1: Core Features
1. Resource management (rooms, equipment)
2. Availability calendar view
3. Booking creation with time slots
4. Booking cancellation with policy enforcement
5. Simulated email confirmations

### Phase 2: Robustness
- **Overlapping Time Ranges**: The most critical bug. Two bookings for the same slot.
- **Timezone Handling**: All times stored in UTC, displayed in resource timezone.
- **Slot Holds**: Temporary reservation before payment (expires after N minutes).
- **Cancellation Policy**: Prevent last-minute cancellations.

### Phase 3: Bug Analysis
**Intentional Bug: Overlapping Bookings Allowed**

Located in `src/services/resourceService.ts` and `src/services/bookingService.ts`.

The overlap check uses flawed OR conditions:

```typescript
// VULNERABLE CODE:
OR: [
  { startTime: { gte: start, lte: end } },
  { endTime: { gte: start, lte: end } },
]
```

This check only catches bookings where the start OR end falls within the queried range. It misses the case where a new booking **completely engulfs** an existing booking:

- Existing: 10:00 - 11:00
- New: 09:00 - 12:00

The new booking's start (09:00) is NOT `gte: 10:00` and its end (12:00) is NOT `lte: 11:00`, so it passes validation. Both bookings exist for the same resource at the same time.

**Impact**: Double-booking of rooms/resources.

**Fix**: Use the mathematically correct overlap condition:
```typescript
AND: [
  { startTime: { lt: end } },   // existing starts before new ends
  { endTime: { gt: start } },   // existing ends after new starts
]
```

Or in raw SQL:
```sql
SELECT * FROM bookings
WHERE resource_id = ?
  AND status = 'CONFIRMED'
  AND start_time < ? AND end_time > ?
```

**Secondary Bug: Timezone Confusion**

Located in `src/utils/timezone.ts`. The `toUTC()` function does not actually convert from the given timezone to UTC. It assumes the input is already UTC or local time. In production, this causes bookings to be stored at the wrong time when users in different timezones create bookings.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/resources` | List all resources |
| GET | `/resources/:id` | Get resource details |
| GET | `/resources/:id/availability` | Check availability for time range |
| POST | `/bookings` | Create a booking |
| POST | `/bookings/hold` | Hold a slot temporarily |
| GET | `/bookings/my` | Get user's bookings |
| POST | `/bookings/:id/cancel` | Cancel a booking |
| GET | `/health` | Health check |

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL and Redis
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Run tests
npm test

# Start development server
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://booking:booking123@localhost:5433/booking
REDIS_URL=redis://localhost:6380
PORT=3000
```

## Testing the Bug

Create a booking for 10:00-11:00, then create another booking for 09:00-12:00. The second booking incorrectly succeeds.

```bash
curl -X POST http://localhost:3001/bookings \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"res-1","userId":"user-1","startTime":"2025-06-01T10:00:00Z","endTime":"2025-06-01T11:00:00Z"}'

curl -X POST http://localhost:3001/bookings \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"res-1","userId":"user-2","startTime":"2025-06-01T09:00:00Z","endTime":"2025-06-01T12:00:00Z"}'
```
