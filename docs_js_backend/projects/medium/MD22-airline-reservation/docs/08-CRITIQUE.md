# Critique & Reflection

## What Went Well

1. **Realistic domain**: Airline systems are well-documented and have clear business rules
2. **Critical bug**: Overbooking is a well-known real problem (United 3411, Delta outages)
3. **Rich feature set**: Seat maps, baggage, check-in create a complete picture
4. **Educational value**: Students learn about transactions and locking

## What Could Be Better

1. **Simplified aircraft config**: Real aircraft have complex seat maps with different sections
2. **No GDS integration**: Real systems connect to Amadeus/Sabre
3. **Missing pricing engine**: No yield management or dynamic pricing
4. **No waitlist**: Real systems have standby lists for oversold flights

## Design Critique

### Architecture
- **Good**: Clean separation, RESTful API
- **Bad**: No event-driven updates for flight status changes
- **Suggestion**: Add WebSocket or SSE for real-time seat map updates

### Database Schema
- **Good**: Seat-level granularity
- **Bad**: No versioning for flight schedule changes
- **Suggestion**: Add `flight_schedule_versions` for tracking changes

### API Design
- **Good**: Standard endpoints
- **Bad**: No batch operations for group bookings
- **Suggestion**: Add bulk booking endpoint for families/groups

### Error Handling
- **Good**: Specific error codes
- **Bad**: No retry guidance for transient failures
- **Suggestion**: Return Retry-After headers for conflict errors

## Lessons Learned

1. **Capacity constraints belong in the database**: Application checks are insufficient
2. **Seat-level booking is complex**: Counter-based is simpler but less flexible
3. **Airline domain has rich business rules**: Makes for excellent learning material
4. **Concurrent testing is essential**: Bugs only appear under load

## Alternative Architectures

### Event Sourcing
Store all seat allocation events as immutable log. Current state is computed by replaying events. Excellent for audit but complex.

### CQRS
Separate read model (seat map queries) from write model (booking commands). Read model can be stale by design.

### Actor Model
Each flight is an actor that serializes all booking requests. Natural fit for this domain but requires different infrastructure (Akka, Orleans).
