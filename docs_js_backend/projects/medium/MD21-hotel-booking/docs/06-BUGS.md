# Bug Documentation

## Bug: Race Condition in Room Availability

### Severity
**High** - Can lead to overbooking, guest dissatisfaction, financial loss.

### Reproduction Steps

1. Ensure only 1 room is available for a date range
2. Send two `POST /api/bookings` requests simultaneously
3. Both requests pass availability check
4. Both bookings are created
5. Result: 2 bookings for 1 room

### Root Cause

The `createBooking` method in `booking.service.ts` performs:

```typescript
// 1. Check availability (read query)
const isAvailable = await this.roomService.checkAvailability(...);

// 2. Artificial delay (simulated processing)
await new Promise(resolve => setTimeout(resolve, 100));

// 3. Create booking (write query)
return prisma.booking.create({...});
```

Steps 1 and 3 are separate database queries without any locking mechanism. Two concurrent requests can both see the room as available before either writes the booking.

### Code Location

File: `src/services/booking.service.ts`
Method: `createBooking`
Lines: 13-42

### Test Reproduction

File: `tests/booking.test.ts`
Test: `should detect race condition - two simultaneous bookings of last room`

Run: `npm test -- tests/booking.test.ts`

### Fix Strategy

1. **Immediate fix**: Wrap check-and-book in a transaction with advisory lock
2. **Robust fix**: Add exclusion constraint at database level
3. **Monitoring**: Add overbooking detection alerts

### Prevention

- Always use atomic operations for limited resources
- Apply database constraints as safety net
- Load test concurrent booking scenarios
- Consider queue-based processing for high-truth operations
