# MD13 Event Sourcing + CQRS — v7 Production Setup

## Overview
The final evolution step completes the event-sourced architecture: commands write only to the event store, projections update the read model asynchronously, snapshots speed up replay, and the API enforces CQRS by rejecting direct reads from the write model.

## Changes
- **Write Model**: `PlaceOrderCommand` and `CancelOrderCommand` append events exclusively.
- **Read Model**: `OrderReadModel` queries the projection table only.
- **Async Projections**: `setImmediate(() => projection.project(...))` decouples write latency from read consistency.
- **Snapshots**: Every 100 events, a snapshot is stored so replay stays under 10ms.
- **OCC**: `UNIQUE(aggregate_id, version)` prevents concurrent command conflicts.
- **Schema Evolution**: `upcastOrderPlacedEvent` handles old event formats.
- **Deployment**: `docker-compose.yml` with PostgreSQL.

## Code Snippet
```typescript
// src/commands/place-order.ts (production)
export class PlaceOrderCommand {
  async execute(input: PlaceOrderInput) {
    const validated = placeOrderSchema.parse(input);
    const aggregateId = uuidv4();
    const event = createOrderPlacedEvent({ aggregateId, ...validated, version: 1 });
    await this.eventStore.append(event);
    setImmediate(() => this.projection.project(aggregateId).catch(console.error));
    return { aggregateId, version: event.version };
  }
}
```

```typescript
// src/read-model/order-read-model.ts (CQRS enforcement)
async getById(id: string) {
  // CORRECT: read model only
  return prisma.orderReadModel.findUnique({ where: { aggregateId: id } });
}

// BUG introduced for education: getByIdFromEventStore bypasses read model
```

## Rationale
- Event sourcing makes the log the source of truth, providing immutable audit history.
- CQRS lets the read model be denormalized and indexed independently.
- Snapshots prevent replay from becoming O(n) for long-lived aggregates.

## Trade-offs
- `setImmediate` projections are lost on crash; production should use an outbox pattern or message bus.
- Eventual consistency means clients may see 404 for ~100ms after creation; handle with 202 Accepted or synchronous projection for critical paths.

## References
- `docs/02-DECISIONS.md` — why PostgreSQL for event store, async projections, and snapshots.
- `docs/06-BUGS.md` — direct read from write model and eventual consistency gap.
- `docs/03-CONCEPTS.md` — event sourcing, CQRS, projections, snapshots, OCC.
