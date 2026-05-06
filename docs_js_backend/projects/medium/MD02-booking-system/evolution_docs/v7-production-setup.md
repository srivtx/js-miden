# MD02 Booking System — v7 Production Setup

Your booking system works. It has types, validation, logs, tests, and ESM. But a real booking system is a concurrency nightmare. Two users clicking "Book" at the same millisecond can destroy your reputation.

## Pain #1: SQLite Locks Under Concurrent Bookings

You started with SQLite. At 10 concurrent booking attempts for a popular room, SQLite throws `SQLITE_BUSY`. Users see "Please try again." They don't try again. They book with your competitor.

**Evolution: SQLite → PostgreSQL**

```prisma
// prisma/schema.prisma
model Room {
  id        String   @id
  name      String
  openHour  Int
  closeHour Int
  bookings  Booking[]
}

model Booking {
  id        String   @id @default(uuid())
  roomId    String
  startTime DateTime @db.Timestamptz()
  endTime   DateTime @db.Timestamptz()
  userId    String
  status    BookingStatus @default(CONFIRMED)
  expiresAt DateTime? @db.Timestamptz()
  createdAt DateTime @default(now())

  room Room @relation(fields: [roomId], references: [id])

  @@index([roomId, startTime, endTime])
  @@index([userId, startTime])
  @@index([status, expiresAt])
}
```

PostgreSQL handles concurrent writes with MVCC. No `SQLITE_BUSY`.

**Evolution: Raw SQL → Prisma**

```ts
// Before: string concatenation, no autocomplete
const result = await db.query(`SELECT * FROM bookings WHERE room_id = '${roomId}'`);

// After: type-safe, relation-aware
const bookings = await prisma.booking.findMany({
  where: {
    roomId,
    status: { not: 'CANCELLED' },
    startTime: { gte: today },
  },
  include: { room: true },
});
```

## Pain #2: Double Booking Under Race Conditions

Two users click "Book" for the same slot:

```
T1: check overlap → none found
T2: check overlap → none found
T1: insert booking
T2: insert booking
```

Both succeed. You have two confirmed bookings for the same room at the same time.

**Evolution: Read → Transactional Insert with Exclusion Constraint**

```sql
-- PostgreSQL exclusion constraint prevents overlapping intervals
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  room_id WITH =,
  tstzrange(start_time, end_time) WITH &&
)
WHERE (status != 'cancelled');
```

```ts
async function createBooking(req: CreateBookingRequest): Promise<Booking> {
  return await prisma.$transaction(async (tx) => {
    // The exclusion constraint makes this INSERT atomic
    const booking = await tx.booking.create({
      data: {
        roomId: req.roomId,
        startTime: req.start,
        endTime: new Date(req.start.getTime() + req.durationMinutes * 60000),
        userId: req.userId,
        status: 'CONFIRMED',
      },
    });
    return booking;
  }, {
    isolationLevel: 'Serializable',
  });
}
```

If two transactions try to insert overlapping ranges, PostgreSQL blocks one until the other commits. If the range now overlaps, PostgreSQL raises a unique violation. One booking succeeds, one fails cleanly.

## Pain #3: Users Abandon Holds

A user starts booking, gets distracted, never completes payment. The hold blocks the slot for 30 minutes. Real customers can't book.

**Evolution: In-Memory Timeout → Redis TTL**

```ts
// src/services/redisHoldManager.ts
import Redis from 'ioredis';

export class RedisHoldManager {
  private redis = new Redis(process.env.REDIS_URL);

  async createHold(
    roomId: string,
    slot: TimeSlot,
    userId: string,
    ttlMinutes: number
  ): Promise<string> {
    const holdId = crypto.randomUUID();
    const hold = {
      id: holdId,
      roomId,
      startTime: slot.start.toISOString(),
      endTime: slot.end.toISOString(),
      userId,
      status: 'HOLD',
    };

    // Redis TTL automatically expires the hold
    await this.redis.setex(
      `hold:${holdId}`,
      ttlMinutes * 60,
      JSON.stringify(hold)
    );

    // Also add to room index for overlap checks
    await this.redis.zadd(
      `room:${roomId}:holds`,
      slot.start.getTime(),
      holdId
    );

    return holdId;
  }

  async getActiveHolds(roomId: string): Promise<Hold[]> {
    const holdIds = await this.redis.zrangebyscore(
      `room:${roomId}:holds`,
      '-inf',
      '+inf'
    );

    const holds = await Promise.all(
      holdIds.map(id => this.redis.get(`hold:${id}`))
    );

    return holds.filter(Boolean).map(h => JSON.parse(h!));
  }
}
```

Redis handles expiry natively. No `setTimeout` queue. No memory leaks. Holds disappear automatically.

## Pain #4: Architecture Spaghetti

Your route handler queries the database, checks Redis, validates business hours, sends confirmation emails, and updates analytics. It's 300 lines. Changing email templates breaks availability checks.

**Evolution: Monolith → Layered → Service-Based**

```
┌─────────────────┐
│   API Routes    │  ← Validation, auth, HTTP
├─────────────────┤
│ Booking Service │  ← Orchestration, business rules
├─────────────────┤
│ Booking Repo    │  ← Database (Prisma)
│ Room Repo       │
│ Hold Manager    │  ← Redis
├─────────────────┤
│  Notification   │  ← Email/SMS service
│   Service       │
└─────────────────┘
```

```ts
// src/services/bookingService.ts
export class BookingService {
  constructor(
    private bookingRepo: IBookingRepository,
    private roomRepo: IRoomRepository,
    private holdManager: IHoldManager,
    private notifier: INotificationService,
  ) {}

  async createBooking(req: CreateBookingRequest): Promise<Booking> {
    const room = await this.roomRepo.findById(req.roomId);
    if (!room) throw new Error('Room not found');

    this.validateBusinessHours(room, req.start, req.durationMinutes);

    const booking = await this.bookingRepo.create(req);
    await this.notifier.sendConfirmation(booking);

    return booking;
  }

  async createHold(roomId: string, slot: TimeSlot, userId: string): Promise<Hold> {
    // Check both confirmed bookings AND active holds
    const [bookings, holds] = await Promise.all([
      this.bookingRepo.findOverlapping(roomId, slot),
      this.holdManager.getActiveHolds(roomId),
    ]);

    const hasOverlap = bookings.length > 0 || holds.some(h => overlaps(h.slot, slot));
    if (hasOverlap) throw new Error('Slot unavailable');

    return this.holdManager.createHold(roomId, slot, userId, 30);
  }
}
```

## Pain #5: Cancellations and Refunds

A user cancels. You delete the booking. But they already paid. Now you have to refund. You deleted the booking record, so you don't know how much to refund. The payment provider asks for the original transaction ID. You don't have it.

**Evolution: Soft Deletes + Audit Trail**

```ts
async function cancelBooking(bookingId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking || booking.userId !== userId) {
      throw new Error('Booking not found');
    }

    // Soft delete: mark as cancelled, don't remove
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // Record audit
    await tx.auditLog.create({
      data: {
        bookingId,
        userId,
        action: 'CANCEL',
        reason: 'user_request',
        paymentId: booking.payment?.id,
      },
    });

    // Trigger refund (async)
    await refundQueue.add({
      paymentId: booking.payment!.id,
      amount: booking.payment!.amount,
    });
  });
}
```

The booking stays in the database. Cancellations are traceable. Refunds have context.

## Pain #6: Recurring Bookings

A user wants "Room A every Monday at 10:00 for the next 3 months." Your system handles single bookings. They create 12 separate bookings. One fails due to a holiday. The other 11 succeed. The user shows up on the holiday. The room is locked.

**Evolution: Recurring Rules**

```prisma
model RecurringBooking {
  id          String   @id @default(uuid())
  roomId      String
  userId      String
  startTime   DateTime @db.Timestamptz()
  durationMinutes Int
  frequency   String   // WEEKLY, BIWEEKLY, MONTHLY
  count       Int      // number of occurrences
  exceptions  DateTime[] // excluded dates
  bookings    Booking[]
}
```

```ts
async function createRecurring(req: RecurringBookingRequest): Promise<Booking[]> {
  const slots = generateRecurringSlots(req);

  // Validate ALL slots before creating any
  for (const slot of slots) {
    const available = await bookingRepo.isAvailable(req.roomId, slot);
    if (!available) throw new Error(`Slot unavailable: ${slot.start}`);
  }

  // Create all in a transaction
  return await prisma.$transaction(async (tx) => {
    const recurring = await tx.recurringBooking.create({ data: req });
    const bookings = [];

    for (const slot of slots) {
      bookings.push(await tx.booking.create({
        data: {
          roomId: req.roomId,
          startTime: slot.start,
          endTime: slot.end,
          userId: req.userId,
          status: 'CONFIRMED',
          recurringId: recurring.id,
        },
      }));
    }

    return bookings;
  });
}
```

All-or-nothing. No partial recurring series.

## Final Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Gateway │────▶│   Express   │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
              ┌─────────────────────────────────┼─────────────────────────────────┐
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │  Booking  │                   │    Hold        │                 │ Notification│
        │  Service  │                   │   Manager      │                 │  Service    │
        └─────┬─────┘                   └───────┬────────┘                 └──────┬─────┘
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │ PostgreSQL │                   │     Redis      │                 │   Queue    │
        │ (Bookings) │                   │   (Holds TTL)  │                 │  (Email)   │
        └────────────┘                   └────────────────┘                 └────────────┘
```

## Production Checklist

- [ ] PostgreSQL with exclusion constraints for overlap prevention
- [ ] Prisma migrations for schema evolution
- [ ] Redis for hold management with TTL
- [ ] Serializable transactions for booking creation
- [ ] Soft deletes for cancellations and audit
- [ ] Recurring booking support with all-or-nothing transactions
- [ ] Layered architecture (routes → services → repos)
- [ ] Async notification queue
- [ ] Connection pooling (PgBouncer)
- [ ] Redis Sentinel for HA

This is a production booking system. It started as a flat array. Now it prevents double-booking with database constraints, manages holds with Redis TTL, and handles recurring reservations with atomic transactions.
