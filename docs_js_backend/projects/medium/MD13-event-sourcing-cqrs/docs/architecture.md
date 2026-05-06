# Architecture

## Overview

E-commerce platform implementing Event Sourcing and CQRS patterns with separate read/write models.

## System Architecture

```
┌─────────────────┐
│   Client App    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Commands│ │Queries │
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌────────────┐ ┌──────────────┐
│ Write Model │ │  Read Model  │
│ Event Store │ │  PostgreSQL  │
│ (Events)    │ │  (Projections)│
└─────┬──────┘ └──────┬───────┘
      │               │
      │    ┌──────────┘
      │    │
      ▼    ▼
┌──────────────────┐
│   Projections    │
│  (Event Replay)  │
└──────────────────┘
```

## CQRS Pattern

### Command Side
- Handles writes
- Validates business rules
- Emits events
- No queries allowed

### Query Side
- Optimized for reads
- Eventually consistent
- Projected from events
- No writes allowed

## Event Sourcing

### Event Store
Append-only log of all domain events:
```
Event 1: OrderPlaced
Event 2: OrderConfirmed
Event 3: OrderShipped
Event 4: OrderCancelled
```

### Event Replay
Rebuild state by replaying events:
```typescript
const events = await eventStore.getEvents(orderId);
const state = replayEvents(events);
```

### Snapshots
Periodic snapshots for performance:
```typescript
if (events.length % 100 === 0) {
  await eventStore.createSnapshot(aggregateId, state, version);
}
```

## Key Components

### Commands
- `PlaceOrderCommand`: Creates new order
- `CancelOrderCommand`: Cancels existing order

### Events
- `OrderPlaced`: Order created
- `OrderCancelled`: Order cancelled

### Projections
- `OrderProjection`: Projects events to read model

### Read Model
- `OrderReadModel`: Query-optimized order data

## Known Issues

### Direct Read from Write Model
The `getByIdFromEventStore` method queries the event store directly, defeating CQRS separation.

### Eventual Consistency Gap
After placing an order, the read model may not reflect the change immediately.

## Research Citations

1. Young, G. (2010). "CQRS, Task Based UIs, Event Sourcing agh!"
2. Vernon, V. (2013). "Implementing Domain-Driven Design". Addison-Wesley.
3. Betts, D. et al. (2013). "Exploring CQRS and Event Sourcing". Microsoft Patterns & Practices.
4. Fowler, M. (2005). "Event Sourcing". martinfowler.com
5. Hohpe, G. & Woolf, B. (2003). "Enterprise Integration Patterns". Addison-Wesley.