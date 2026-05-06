# MD02 Booking System — v3 Adding Validation

## The Attack

You thought TypeScript was enough. Then a user sent this:

```json
POST /book
{ "roomId": "A", "start": "2025-06-01T10:00:00Z", "durationMinutes": -30, "userId": "alice" }
```

A negative duration. Your calendar code generates slots backwards. The database stores an end time before the start time. The calendar UI breaks.

Then someone sent:
```json
{ "roomId": "../../../etc/passwd", "start": "2025-06-01T10:00:00Z", "durationMinutes": 30 }
```

If you were logging room IDs to a file path (and you were, in v1), you've got path traversal.

## The Fix: Defense in Depth

### 1. Request Validation (Zod)

```ts
import { z } from 'zod';

const createBookingSchema = z.object({
  roomId: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  start: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).multipleOf(15),
  userId: z.string().uuid(),
});

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
```

- `roomId` is alphanumeric only
- `start` must be ISO 8601 datetime
- `durationMinutes` must be 15–480, in 15-minute increments
- `userId` must be a valid UUID

### 2. Business Rule Validation

```ts
async function createBooking(req: CreateBookingRequest): Promise<Booking> {
  const start = new Date(req.start);
  const end = new Date(start.getTime() + req.durationMinutes * 60000);

  // Check room exists
  const room = await db.query('SELECT * FROM rooms WHERE id = $1', [req.roomId]);
  if (!room.rows[0]) throw new Error('Room not found');

  // Check business hours
  const startHour = start.getHours();
  if (startHour < room.rows[0].open_hour || end.getHours() > room.rows[0].close_hour) {
    throw new Error('Booking outside business hours');
  }

  // Check overlap
  const overlap = await db.query(
    `SELECT 1 FROM bookings
     WHERE room_id = $1
       AND status != 'cancelled'
       AND start_time < $2
       AND end_time > $3`,
    [req.roomId, end, start]
  );
  if (overlap.rows.length > 0) {
    throw new Error('Slot already booked');
  }

  // Check user hasn't exceeded limit
  const userBookings = await db.query(
    `SELECT COUNT(*) FROM bookings
     WHERE user_id = $1 AND start_time >= CURRENT_DATE AND status = 'confirmed'`,
    [req.userId]
  );
  if (parseInt(userBookings.rows[0].count) >= 5) {
    throw new Error('Daily booking limit exceeded');
  }

  const booking = await db.query(
    `INSERT INTO bookings (room_id, start_time, end_time, user_id, status)
     VALUES ($1, $2, $3, $4, 'confirmed')
     RETURNING *`,
    [req.roomId, start, end, req.userId]
  );

  return booking.rows[0];
}
```

### 3. Database Constraints

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(50) NOT NULL REFERENCES rooms(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'hold', 'cancelled')),
  CHECK (end_time > start_time),
  CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) / 60 BETWEEN 15 AND 480)
);

CREATE INDEX idx_bookings_overlap ON bookings (room_id, start_time, end_time)
WHERE status != 'cancelled';
```

The database enforces:
- End time must be after start time
- Duration must be 15–480 minutes
- Status must be valid enum value
- The index makes overlap checks fast

## The Bug

The overlap check is a read-then-write. Two requests can read simultaneously, both see no overlap, both insert.

```
T1: check overlap → none
T2: check overlap → none
T1: insert booking
T2: insert booking (DOUBLE BOOKED!)
```

You need a unique constraint or transaction isolation for true safety.

**Next:** Let's add logging so we can trace booking attempts and failures.
