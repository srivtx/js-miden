# Thinking Process

## Analyzing the Race Condition

When I first looked at the booking flow, I identified these steps:

1. User A queries: "Is room available?" → YES
2. User B queries: "Is room available?" → YES (at the same time)
3. User A creates booking → SUCCESS
4. User B creates booking → SUCCESS (BUG!)

This is a classic **Time-of-Check to Time-of-Use (TOCTOU)** vulnerability.

## Why This Happens

### Database Transaction Isolation

Prisma's default transaction isolation level in PostgreSQL is `Read Committed`. This means:
- Each query sees committed data at the start of the query
- Between the availability check and booking insert, another transaction can commit
- No locking prevents concurrent writes after a read

### The Read-Then-Write Pattern

```typescript
// Step 1: Read
const isAvailable = await checkAvailability(roomId, dates);

// Gap: Other transaction can commit here!

// Step 2: Write
await prisma.booking.create({...});
```

This pattern is dangerous for any resource with limited quantity.

## Potential Solutions

1. **Database-level locking** (SELECT FOR UPDATE)
2. **Unique constraints** on room + date ranges
3. **Atomic operations** (single query with CTE)
4. **Optimistic locking** with version numbers
5. **Pessimistic locking** with advisory locks
6. **Queue-based booking** (serialize all booking requests)

## Constraints

- Must work with PostgreSQL
- Must handle date ranges (not just single dates)
- Must allow cancellations (release inventory)
- Must support multiple room types
- Must be performant (don't lock entire table)
