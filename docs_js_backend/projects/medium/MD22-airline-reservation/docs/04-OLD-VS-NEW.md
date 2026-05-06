# Old vs New Approach

## Old Approach (Buggy)

```typescript
async createBooking(data) {
  const seat = await prisma.seat.findUnique({
    where: { id: data.seatId },
    include: { booking: true },
  });

  if (seat.booking) {
    throw new Error('Seat unavailable');
  }

  // BUG: No capacity check!
  // BUG: Race condition possible even on seat check
  
  return prisma.booking.create({ data });
}
```

**Problems**:
- No total capacity validation
- Seat availability check is read-then-write (race condition)
- No transaction wrapping
- Doesn't enforce class-level limits

## New Approach (Fixed)

```typescript
async createBooking(data) {
  return prisma.$transaction(async (tx) => {
    // Lock the flight to prevent concurrent bookings
    await tx.$executeRaw`
      SELECT * FROM flights WHERE id = ${data.flightId} FOR UPDATE
    `;

    // Check total capacity
    const bookingCount = await tx.booking.count({
      where: {
        flightId: data.flightId,
        status: { not: 'CANCELLED' },
      },
    });

    const flight = await tx.flight.findUnique({
      where: { id: data.flightId },
      include: { aircraft: true },
    });

    if (bookingCount >= flight.aircraft.totalSeats) {
      throw new AppError(409, 'Flight is fully booked', 'FLIGHT_FULL');
    }

    // Check class-specific capacity
    const classCount = await tx.booking.count({
      where: {
        flightId: data.flightId,
        bookingClass: data.bookingClass,
        status: { not: 'CANCELLED' },
      },
    });

    const classLimit = flight.aircraft[`${data.bookingClass.toLowerCase()}Seats`];
    if (classCount >= classLimit) {
      throw new AppError(409, 'No seats available in this class', 'CLASS_FULL');
    }

    // Check seat availability (now safe due to transaction lock)
    const seat = await tx.seat.findUnique({
      where: { id: data.seatId },
      include: { booking: true },
    });

    if (!seat || seat.booking) {
      throw new AppError(409, 'Seat unavailable', 'SEAT_UNAVAILABLE');
    }

    return tx.booking.create({ data });
  });
}
```

**Improvements**:
- Atomic transaction with row locking
- Total capacity enforcement
- Class-level capacity enforcement
- Seat availability re-checked within locked transaction
- No race conditions possible

## Alternative: Optimistic with Retry

```typescript
async createBooking(data) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await attemptBooking(data);
    } catch (e) {
      if (e.code === 'P2034') { // Prisma transaction conflict
        continue;
      }
      throw e;
    }
  }
  throw new AppError(409, 'Unable to complete booking', 'BOOKING_FAILED');
}
```
