# MD02 Booking System — v4 Adding Logging

## The Incident

A hotel calls: "We have three bookings for the same suite at the same time. The guests are fighting in the lobby."

You check the database. Three confirmed bookings for Room 101, 2025-06-01 14:00–15:00. Your overlap check failed. But when? How? By whom?

You have no logs. You can't reconstruct the sequence.

## The Fix: Structured Logging + Audit Trail

```ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization'],
});

export function logBookingEvent(
  event: string,
  bookingId: string,
  roomId: string,
  userId: string,
  start: Date,
  end: Date,
  metadata?: Record<string, unknown>
) {
  logger.info({
    event: `booking_${event}`,
    bookingId,
    roomId,
    userId,
    start: start.toISOString(),
    end: end.toISOString(),
    ...metadata,
    timestamp: new Date().toISOString(),
  });
}
```

### Logging Every Critical Path

```ts
async function createBooking(req: CreateBookingRequest): Promise<Booking> {
  const start = Date.now();
  const bookingId = crypto.randomUUID();

  logger.info({
    event: 'booking_attempt',
    bookingId,
    roomId: req.roomId,
    userId: req.userId,
    proposedStart: req.start,
    proposedEnd: new Date(new Date(req.start).getTime() + req.durationMinutes * 60000).toISOString(),
  });

  try {
    // Check overlap with explicit logging
    const overlap = await checkOverlap(req.roomId, new Date(req.start), endTime);
    if (overlap.length > 0) {
      logger.warn({
        event: 'booking_overlap_detected',
        bookingId,
        roomId: req.roomId,
        conflictingBookings: overlap.map(b => b.id),
      });
      throw new Error('Slot already booked');
    }

    const booking = await insertBooking(bookingId, req);
    logBookingEvent('created', bookingId, req.roomId, req.userId, booking.start, booking.end, {
      durationMs: Date.now() - start,
    });

    return booking;
  } catch (err) {
    logger.error({
      event: 'booking_failed',
      bookingId,
      roomId: req.roomId,
      userId: req.userId,
      error: (err as Error).message,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}
```

### Hold Lifecycle Logging

```ts
async function createHold(roomId: string, slot: TimeSlot, userId: string, ttlMinutes: number): Promise<Booking> {
  const holdId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60000);

  logger.info({
    event: 'hold_created',
    holdId,
    roomId,
    userId,
    slotStart: slot.start.toISOString(),
    slotEnd: slot.end.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttlMinutes,
  });

  await db.query(
    `INSERT INTO bookings (id, room_id, start_time, end_time, user_id, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'hold', $6)`,
    [holdId, roomId, slot.start, slot.end, userId, expiresAt]
  );

  // Schedule expiry
  setTimeout(async () => {
    const released = await releaseHold(holdId);
    if (released) {
      logger.info({ event: 'hold_expired', holdId, roomId, userId });
    }
  }, ttlMinutes * 60000);

  return getBooking(holdId);
}
```

## Observability: What to Log

| Event | Why |
|-------|-----|
| `booking_attempt` | Trace every booking request |
| `booking_overlap_detected` | Detect race conditions |
| `booking_created` | Successful bookings |
| `booking_cancelled` | Cancellations for audit |
| `hold_created` | Track temporary reservations |
| `hold_expired` | Track hold cleanup |
| `booking_failed` | Errors for debugging |

## The Dashboard Query

```sql
-- Double-booking detection
SELECT room_id, start_time, end_time, COUNT(*) as booking_count
FROM bookings
WHERE status = 'confirmed'
  AND start_time > NOW() - INTERVAL '7 days'
GROUP BY room_id, start_time, end_time
HAVING COUNT(*) > 1;
```

## The Bug

You log every hold creation. With 10,000 holds per day and 30-minute TTLs, that's 10,000 scheduled `setTimeout` callbacks. Node's timer queue grows unbounded. Memory leaks.

**Fix:** Use a cron job or Redis TTL instead of `setTimeout`.

```ts
await redis.setex(`hold:${holdId}`, ttlMinutes * 60, JSON.stringify({ roomId, userId }));
```

**Next:** Let's write tests so we can prove overlap prevention works under concurrency.
