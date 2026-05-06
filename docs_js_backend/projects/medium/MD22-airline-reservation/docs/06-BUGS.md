# Bug Documentation

## Bug: Overbooking Not Prevented

### Severity
**Critical** - Can sell more seats than physically exist on aircraft.

### Reproduction Steps

1. Create a flight with an aircraft that has N seats
2. Create N+1 concurrent booking requests
3. Observe that more than N bookings are confirmed

### Root Cause

The `createBooking` method in `booking.service.ts` has two issues:

1. **Missing capacity check**: Never validates total bookings against `aircraft.totalSeats`
2. **Race condition on seat check**: Even the seat availability check is read-then-write

```typescript
// Current buggy code:
const seat = await prisma.seat.findUnique({
  where: { id: data.seatId },
  include: { booking: true },
});

if (seat.booking) {
  throw new AppError(409, 'Seat is already booked', 'SEAT_UNAVAILABLE');
}

// No capacity check here!

return prisma.booking.create({ data });
```

### Code Location

File: `src/services/booking.service.ts`
Method: `createBooking`
Lines: 10-50

### Test Reproduction

File: `tests/booking.test.ts`
Test: `should demonstrate overbooking bug`

Run: `npm test -- tests/booking.test.ts`

### Fix Strategy

1. **Immediate**: Add capacity check inside a transaction with `FOR UPDATE` lock
2. **Robust**: Add database trigger preventing insert when count >= capacity
3. **Monitoring**: Alert when booking count approaches capacity

### Prevention

- Always enforce invariant at database level (triggers/constraints)
- Load test with concurrent booking attempts
- Implement booking queue for high-demand flights
- Add audit logs for capacity violations
