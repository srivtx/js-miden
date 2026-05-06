# Old vs New Approach

## Old Approach (Buggy)

```typescript
async createBooking(data) {
  // Read availability
  const isAvailable = await checkAvailability(roomId, dates);
  
  if (!isAvailable) throw new Error('Unavailable');
  
  // ... gap where race condition occurs ...
  
  // Write booking
  return prisma.booking.create({ data });
}
```

**Problems**:
- Non-atomic read-write
- TOCTOU vulnerability
- No locking mechanism
- Relies on application-level state

## New Approach (Fixed)

```typescript
async createBooking(data) {
  return prisma.$transaction(async (tx) => {
    // Lock the room for this date range using advisory lock
    const lockKey = generateLockKey(roomId, checkIn, checkOut);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
    
    // Re-check availability within the same transaction
    const isAvailable = await checkAvailability(tx, roomId, dates);
    if (!isAvailable) throw new Error('Unavailable');
    
    // Create booking atomically
    return tx.booking.create({ data });
  });
}
```

**Improvements**:
- Atomic transaction wraps entire operation
- Advisory lock prevents concurrent check-and-book
- Re-checking availability inside transaction catches edge cases
- Lock is automatically released when transaction commits/aborts

## Alternative: Exclusion Constraints

```sql
-- Add exclusion constraint on room availability
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (status != 'CANCELLED');
```

This database-level constraint prevents any overlapping bookings at the database level, making race conditions impossible.
