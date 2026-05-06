# Critic Review

## Technical Review
A senior engineer would say:
- "`setImmediate` for projections is a toy. In production, use a message bus or outbox pattern. If the server crashes between event append and projection, the read model is permanently stale."
- "No saga or process manager. What if `PlaceOrder` needs to reserve inventory, charge payment, and notify shipping? Three aggregates, one transaction boundary. Event sourcing alone doesn't solve distributed transactions."
- "Missing event schema registry. If the `OrderPlaced` event schema changes, consumers break. Use Confluent Schema Registry or JSON Schema versioning."
- "No dead-letter queue for failed projections. If `OrderProjection.project()` throws, the error is logged and lost."

## Security Review
- **Event Tampering**: The event store table has no row-level security. A malicious admin could `UPDATE` or `DELETE` events, destroying the audit trail.
- **Sensitive Data in Events**: `shippingAddress` and `customerId` are stored in plaintext in `eventData`. GDPR right-to-erasure is impossible without event rewriting (which violates immutability).
- **No Authorization in Commands**: Any authenticated user can cancel any order. The `cancelledBy` field is set from user input, not validated against the session.

## Educational Review
- **What's missing**: Event upcasting with multiple schema versions. The current code only handles v1 → v1.
- **What's confusing**: The difference between an aggregate (transaction boundary) and a projection (read model builder) isn't explicitly documented.
- **Suggested addition**: A sequence diagram showing the full flow: HTTP POST → Command Handler → Event Store → Projection → Read Model → HTTP GET.

## Fixes Applied
- Added `getByIdFromEventStore` as a deliberate bug to demonstrate CQRS violation.
- Added async projection with `setImmediate` to demonstrate eventual consistency.
- Added snapshot support for performance.
- Added event schema versioning with `upcastOrderPlacedEvent`.
