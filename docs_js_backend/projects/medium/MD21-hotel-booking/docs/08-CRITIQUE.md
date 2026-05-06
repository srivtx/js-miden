# Critique & Reflection

## What Went Well

1. **Realistic scenario**: Hotel booking is a relatable domain with clear business rules
2. **Subtle bug**: Race conditions are easy to miss in code review but have serious impact
3. **Multiple fix approaches**: Advisory locks, transactions, and exclusion constraints all apply
4. **Complete feature set**: Pricing, cancellation, holds make it a realistic project

## What Could Be Better

1. **Complexity**: The domain requires understanding temporal logic (date ranges, overlaps)
2. **Test flakiness**: Race condition tests are inherently non-deterministic
3. **Over-engineering risk**: Easy to add too many abstractions for a teaching project
4. **Missing features**: No payment integration, no email notifications, no admin dashboard

## Design Critique

### Architecture
- **Good**: Clear separation of routes/controllers/services
- **Bad**: Services directly depend on Prisma client, harder to test
- **Suggestion**: Use repository pattern for better testability

### Database Schema
- **Good**: Normalized structure, proper relations
- **Bad**: No indexing strategy documented
- **Suggestion**: Add indexes on `bookings(roomId, checkIn, checkOut, status)`

### API Design
- **Good**: RESTful endpoints, consistent error format
- **Bad**: No pagination on room list
- **Suggestion**: Add cursor-based pagination for large inventories

### Error Handling
- **Good**: Custom AppError class with codes
- **Bad**: Race condition error message doesn't suggest retry
- **Suggestion**: Return 409 Conflict with Retry-After header

## Lessons Learned

1. **Concurrency is hard**: Even simple read-then-write patterns need careful analysis
2. **Database constraints are safety nets**: Application logic + constraints > application logic alone
3. **Test the edge cases**: Normal flows work; concurrent flows break
4. **Performance vs correctness**: Locks add latency but prevent data corruption

## Alternative Approaches

Instead of fixing the race condition, we could:
- Use an event-sourced inventory system
- Implement a booking queue with FIFO processing
- Use Redis for atomic decrement of available room count
- Apply saga pattern for distributed transactions

Each has trade-offs in complexity, consistency, and scalability.
