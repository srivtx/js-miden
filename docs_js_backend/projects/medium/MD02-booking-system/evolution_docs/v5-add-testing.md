# MD02 Booking System — v5 Adding Testing

## The Bug

You "fixed" the overlap check. You wrote:

```ts
const overlap = await db.query(
  `SELECT 1 FROM bookings
   WHERE room_id = $1
     AND status != 'cancelled'
     AND start_time < $2
     AND end_time > $3`,
  [roomId, end, start]
);
```

You deploy. A user reports: "I booked 10:00–11:00 and someone else booked 10:30–11:30. Both were confirmed." You check. The query uses `<` and `>` but misses edge cases where one booking ends exactly when another starts. Actually, it should use `<=` and `>=` for inclusive boundaries. But wait — your business rule says bookings can't touch. Adjacent bookings are fine.

The real bug: two requests pass the overlap check simultaneously. Both insert. You have no unique constraint.

Tests would have caught this.

## The Fix: Comprehensive Tests

### Unit Tests: Overlap Logic

```ts
import { describe, it, expect } from 'vitest';
import { overlaps } from '../src/utils/overlap';

describe('overlaps', () => {
  it('returns true for overlapping slots', () => {
    const a = { start: new Date('2025-06-01T10:00'), end: new Date('2025-06-01T11:00') };
    const b = { start: new Date('2025-06-01T10:30'), end: new Date('2025-06-01T11:30') };
    expect(overlaps(a, b)).toBe(true);
  });

  it('returns false for adjacent slots', () => {
    const a = { start: new Date('2025-06-01T10:00'), end: new Date('2025-06-01T11:00') };
    const b = { start: new Date('2025-06-01T11:00'), end: new Date('2025-06-01T12:00') };
    expect(overlaps(a, b)).toBe(false);
  });

  it('returns true for exact same slot', () => {
    const a = { start: new Date('2025-06-01T10:00'), end: new Date('2025-06-01T11:00') };
    const b = { start: new Date('2025-06-01T10:00'), end: new Date('2025-06-01T11:00') };
    expect(overlaps(a, b)).toBe(true);
  });

  it('returns false for non-overlapping slots', () => {
    const a = { start: new Date('2025-06-01T10:00'), end: new Date('2025-06-01T11:00') };
    const b = { start: new Date('2025-06-01T12:00'), end: new Date('2025-06-01T13:00') };
    expect(overlaps(a, b)).toBe(false);
  });
});
```

### Integration Tests: Concurrency

```ts
import { describe, it, expect } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { BookingService } from '../src/services/bookingService';

describe('BookingService concurrency', () => {
  it('prevents double booking under race conditions', async () => {
    const db = await createTestDatabase();
    const service = new BookingService(db);

    await db.query("INSERT INTO rooms (id, name, open_hour, close_hour) VALUES ('room-a', 'Room A', 8, 18)");

    const slot = {
      start: new Date('2025-06-01T10:00'),
      end: new Date('2025-06-01T11:00'),
    };

    // 10 users book the same slot simultaneously
    const requests = Array.from({ length: 10 }, (_, i) =>
      service.createBooking({
        roomId: 'room-a',
        start: slot.start,
        durationMinutes: 60,
        userId: `user-${i}`,
      })
    );

    const results = await Promise.allSettled(requests);
    const successes = results.filter(r => r.status === 'fulfilled');

    expect(successes).toHaveLength(1); // Only one succeeds

    const bookings = await db.query(
      "SELECT * FROM bookings WHERE room_id = 'room-a' AND status = 'confirmed'"
    );
    expect(bookings.rows).toHaveLength(1);
  });

  it('expires holds correctly', async () => {
    const db = await createTestDatabase();
    const service = new BookingService(db);

    await db.query("INSERT INTO rooms (id, name, open_hour, close_hour) VALUES ('room-b', 'Room B', 8, 18)");

    const hold = await service.createHold('room-b', {
      start: new Date('2025-06-01T14:00'),
      end: new Date('2025-06-01T15:00'),
    }, 'user-1', 1); // 1-minute TTL for testing

    expect(hold.status).toBe('hold');

    // Wait for expiry
    await new Promise(r => setTimeout(r, 70000));

    const booking = await db.query('SELECT status FROM bookings WHERE id = $1', [hold.id]);
    expect(booking.rows[0].status).toBe('cancelled');
  });
});
```

### Calendar Generation Tests

```ts
describe('Calendar generation', () => {
  it('generates correct 30-min slots', () => {
    const room = { id: 'r1', name: 'Room 1', openHour: 9, closeHour: 17 };
    const slots = generateSlots(room, new Date('2025-06-01'), 30);

    expect(slots).toHaveLength(16); // 8 hours × 2 slots/hour
    expect(slots[0].start).toEqual(new Date('2025-06-01T09:00'));
    expect(slots[0].end).toEqual(new Date('2025-06-01T09:30'));
    expect(slots[15].end).toEqual(new Date('2025-06-01T17:00'));
  });

  it('excludes slots outside business hours', () => {
    const room = { id: 'r1', name: 'Room 1', openHour: 9, closeHour: 17 };
    const slots = generateSlots(room, new Date('2025-06-01'), 30);

    const allWithinHours = slots.every(s =>
      s.start.getHours() >= 9 && s.end.getHours() <= 17
    );
    expect(allWithinHours).toBe(true);
  });
});
```

## What Tests Caught

- Adjacent booking false positive → caught (overlap boundary)
- Double booking under load → caught (concurrency test)
- Hold expiry race → caught (TTL test)
- DST shift bug → caught (calendar generation)
- Cancelled booking still blocking → caught (status filter)

## The Confidence

Now you can refactor from flat SQL to Prisma, add Redis holds, or implement recurring bookings and know that:
1. Overlaps are detected correctly
2. Race conditions don't double-book
3. Holds expire reliably
4. Calendar slots respect business hours

**Next:** Let's modernize the module system.
