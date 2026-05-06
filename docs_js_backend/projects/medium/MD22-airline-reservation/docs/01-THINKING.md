# Thinking Process

## Analyzing the Overbooking Bug

The booking flow has two potential failure points:

### Failure Point 1: Missing Capacity Check

The code only validates:
```typescript
if (seat.booking) {
  throw new AppError(409, 'Seat is already booked', 'SEAT_UNAVAILABLE');
}
```

But never checks:
```typescript
const totalBookings = await prisma.booking.count({
  where: { flightId, status: { not: 'CANCELLED' } }
});
if (totalBookings >= aircraft.totalSeats) {
  throw new AppError(409, 'Flight is fully booked', 'FLIGHT_FULL');
}
```

### Failure Point 2: Race Condition

Even if we added the capacity check, it would still be vulnerable:

1. Request A: Count bookings → 149 (under capacity)
2. Request B: Count bookings → 149 (under capacity, at same time)
3. Request A: Create booking → 150 total
4. Request B: Create booking → 151 total (OVERBOOKED!)

## Why Airlines Overbook

Interestingly, airlines intentionally overbook in real life! They use statistical models predicting no-show rates. But:
- **Intentional overbooking** uses sophisticated yield management
- **Our bug** is unintentional and uncontrolled
- Systems must distinguish between deliberate overbooking and bugs

## Solution Approaches

### Approach 1: Database Constraint

Add a unique constraint or trigger that prevents exceeding capacity.

### Approach 2: Pessimistic Locking

Lock the flight row during booking:
```sql
SELECT * FROM flights WHERE id = ? FOR UPDATE;
```

### Approach 3: Atomic Counter

Use a counter field on flights that decrements atomically:
```sql
UPDATE flights SET available_seats = available_seats - 1 
WHERE id = ? AND available_seats > 0;
```

### Approach 4: Queue-Based

Serialize all booking requests through a message queue.

## Constraints

- Must handle seat-specific bookings (not just counters)
- Must support cancellations (return seat to inventory)
- Must be fast (users won't wait 5 seconds to book)
- Must handle seat class limits (e.g., 20 business max)
